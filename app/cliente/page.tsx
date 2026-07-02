'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getSession } from '../../lib/session'
import {
  DEMAND_SEQUENCE_T1,
  DEMAND_SEQUENCE_T2,
  PRODUCT_COLOR,
  PRODUCT_LABEL,
  type Order,
  type PlayerSession,
  type Product,
} from '../../lib/types'
import { clientDemandOrders, isClientDemandOrder } from '../../lib/metrics'

const MAX_CLIENT_ORDERS = 40

function uniqueSequenceCount(orders: Order[]): number {
  return new Set(orders.map(o => o.sequence_number).filter(n => n >= 1 && n <= MAX_CLIENT_ORDERS)).size
}

function maxClientSequence(orders: Order[]): number {
  if (orders.length === 0) return 0
  return Math.min(MAX_CLIENT_ORDERS, Math.max(...orders.map(o => o.sequence_number)))
}

export default function ClientePage() {
  const [session, setSession] = useState<PlayerSession | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [nextIn, setNextIn] = useState(0)
  const [running, setRunning] = useState(false)
  const [demandFinished, setDemandFinished] = useState(false)
  const [firstIntervalSec, setFirstIntervalSec] = useState(60)
  const [intervalSec, setIntervalSec] = useState(20)
  const [vista, setVista] = useState<'activa' | 'hoja'>('activa')
  const [msg, setMsg] = useState('')

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const firstTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const idxRef = useRef(0)
  const sessionRef = useRef<PlayerSession | null>(null)

  useEffect(() => {
    const s = getSession()
    if (!s || s.role !== 'Cliente') {
      window.location.href = '/'
      return
    }
    setSession(s)
    sessionRef.current = s
  }, [])

  const baseSeq = session?.line === 'B' ? DEMAND_SEQUENCE_T2 : DEMAND_SEQUENCE_T1
  const seq = baseSeq.slice(0, MAX_CLIENT_ORDERS)
  const total = seq.length

  const loadOrders = useCallback(async (s: PlayerSession) => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('room_id', s.roomId)
      .eq('line', s.line)
      .order('sequence_number')

    setOrders((data || []) as Order[])
  }, [])

  useEffect(() => {
    if (!session) return
    let active = true
    const refresh = () => {
      if (active) loadOrders(session)
    }

    refresh()
    const polling = setInterval(refresh, 1000)
    const ch = supabase
      .channel('cliente-' + session.roomId + '-' + session.line)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `room_id=eq.${session.roomId}` },
        refresh
      )
      .subscribe()

    return () => {
      active = false
      clearInterval(polling)
      supabase.removeChannel(ch)
    }
  }, [session, loadOrders])

  // IMPORTANTE:
  // La tabla orders contiene dos mundos mezclados:
  // 1) pedidos del cliente: pendiente / entregado_ok / entregado_tarde / no_entregado
  // 2) órdenes de producción: ensamble, horno, almacén, stock_consumido
  // Por eso el cliente solo debe contar pedidos del cliente, no productos de producción.
  const clientOrders = clientDemandOrders(orders)
  const pendingClientOrders = clientOrders
    .filter(o => o.status === 'pendiente' && !o.client_verdict)
    .sort((a, b) => a.sequence_number - b.sequence_number)

  useEffect(() => {
    if (!session || running) return
    const maxSeq = maxClientSequence(clientOrders)
    setCurrentIdx(maxSeq)
    idxRef.current = maxSeq
    setDemandFinished(maxSeq >= total && total > 0)
  }, [session, running, total, clientOrders.length])

  async function saveNpsScore(s: PlayerSession, score: 0 | 1 | 2) {
    await supabase.from('nps_responses').insert({ room_id: s.roomId, line: s.line, score })
  }

  async function autoMarkUnansweredBefore(s: PlayerSession, nextSequenceNumber: number) {
    const now = new Date().toISOString()
    const { data: unanswered } = await supabase
      .from('orders')
      .select('id')
      .eq('room_id', s.roomId)
      .eq('line', s.line)
      .eq('status', 'pendiente')
      .lt('sequence_number', nextSequenceNumber)
      .is('client_verdict', null)

    if (!unanswered || unanswered.length === 0) return

    const ids = unanswered.map(o => o.id)

    await supabase
      .from('orders')
      .update({
        client_verdict: 'no_entregado',
        status: 'no_entregado',
        delivered_at: now,
      })
      .in('id', ids)

    await supabase.from('nps_responses').insert(
      ids.map(() => ({ room_id: s.roomId, line: s.line, score: 0 }))
    )
  }

  async function hasStockAtRequest(s: PlayerSession, product: Product) {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', s.roomId)
      .eq('line', s.line)
      .eq('product', product)
      .eq('status', 'en_almacen')

    return (count || 0) > 0
  }

  async function createOrder(s: PlayerSession, idx: number) {
    if (idx >= seq.length) return

    const nextSequenceNumber = idx + 1
    const product = seq[idx]
    const requestedAt = new Date().toISOString()

    await autoMarkUnansweredBefore(s, nextSequenceNumber)
    const stockReady = await hasStockAtRequest(s, product)

    await supabase.from('orders').insert({
      room_id: s.roomId,
      line: s.line,
      sequence_number: nextSequenceNumber,
      product,
      status: 'pendiente',
      requested_at: requestedAt,
      notes: stockReady ? 'cliente_pedido;stock_disponible_al_pedir' : 'cliente_pedido',
    })

    await loadOrders(s)
  }

  async function finishDemand() {
    const s = sessionRef.current
    if (s) {
      await autoMarkUnansweredBefore(s, seq.length + 1)
      await loadOrders(s)
    }
    stopDemand()
    setDemandFinished(true)
    setNextIn(0)
  }

  async function startDemand() {
    const s = sessionRef.current
    if (!s) return

    stopDemand()

    const startFrom = Math.max(currentIdx, maxClientSequence(clientOrders))

    if (startFrom >= MAX_CLIENT_ORDERS || startFrom >= seq.length) {
      await finishDemand()
      return
    }

    setDemandFinished(false)
    setRunning(true)
    idxRef.current = startFrom
    setCurrentIdx(startFrom)

    // Si no existe ningún pedido del cliente, se respeta el tiempo inicial.
    // Si se reanuda con pedidos ya creados, se usa el intervalo normal.
    const firstDelay = startFrom === 0 ? firstIntervalSec : intervalSec
    setNextIn(firstDelay)

    countdownRef.current = setInterval(() => {
      setNextIn(prev => (prev <= 1 ? intervalSec : prev - 1))
    }, 1000)

    async function createNextAndStartRegularTimer() {
      const sNow = sessionRef.current
      if (!sNow) return

      const firstToCreate = idxRef.current

      if (firstToCreate >= seq.length || firstToCreate >= MAX_CLIENT_ORDERS) {
        await finishDemand()
        return
      }

      await createOrder(sNow, firstToCreate)
      idxRef.current++
      setCurrentIdx(idxRef.current)
      setNextIn(intervalSec)

      timerRef.current = setInterval(async () => {
        const sTimer = sessionRef.current
        if (!sTimer) return

        const cur = idxRef.current

        if (cur >= seq.length || cur >= MAX_CLIENT_ORDERS) {
          await finishDemand()
          return
        }

        await createOrder(sTimer, cur)
        idxRef.current++
        setCurrentIdx(idxRef.current)
        setNextIn(intervalSec)
      }, intervalSec * 1000)
    }

    firstTimeoutRef.current = setTimeout(createNextAndStartRegularTimer, firstDelay * 1000)
  }

  function stopDemand() {
    setRunning(false)
    if (firstTimeoutRef.current) clearTimeout(firstTimeoutRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    firstTimeoutRef.current = null
    timerRef.current = null
    countdownRef.current = null
  }

  useEffect(() => () => stopDemand(), [])

  async function resetClientDemand() {
    if (!session) return
    if (!confirm('¿Reiniciar SOLO los pedidos del cliente de esta línea? No borra producción, horno ni almacén.')) return

    stopDemand()
    setMsg('Reiniciando demanda del cliente...')

    const ids = clientOrders.map(o => o.id)
    if (ids.length > 0) {
      await supabase.from('orders').delete().in('id', ids)
    }
    await supabase
      .from('nps_responses')
      .delete()
      .eq('room_id', session.roomId)
      .eq('line', session.line)

    setCurrentIdx(0)
    idxRef.current = 0
    setDemandFinished(false)
    setNextIn(0)
    setMsg('Demanda reiniciada. Ahora sí el primer pedido esperará el tiempo configurado.')
    await loadOrders(session)
  }

  async function consumeStockFor(order: Order, deliveredAt: string) {
    if (!session) return true

    // Si almacén ya consumió el stock físicamente, el cliente no debe consumirlo otra vez.
    if (String(order.notes || '').includes('entregado_por_almacen')) return true

    const { data: stockItem } = await supabase
      .from('orders')
      .select('id')
      .eq('room_id', session.roomId)
      .eq('line', session.line)
      .eq('product', order.product)
      .eq('status', 'en_almacen')
      .order('almacen_entry', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!stockItem) return false

    await supabase
      .from('orders')
      .update({
        status: 'stock_consumido',
        delivered_at: deliveredAt,
        notes: `Consumido por pedido #${order.sequence_number}`,
      })
      .eq('id', stockItem.id)

    return true
  }

  async function markVerdict(order: Order, verdict: 'ok' | 'tarde' | 'no_entregado') {
    if (!session) return
    setMsg('')

    const statusMap = {
      ok: 'entregado_ok',
      tarde: 'entregado_tarde',
      no_entregado: 'no_entregado',
    } as const

    const nps = verdict === 'ok' ? 2 : verdict === 'tarde' ? 1 : 0

    // Regla del juego:
    // A tiempo = había stock cuando el cliente pidió; tiempo 0.
    // Tarde = no había stock al inicio, pero llegó antes del siguiente pedido.
    const deliveredAt = verdict === 'ok' ? order.requested_at : new Date().toISOString()

    if (verdict === 'ok' || verdict === 'tarde') {
      const consumed = await consumeStockFor(order, deliveredAt)
      if (!consumed) {
        setMsg('No hay stock disponible para recibir ese producto.')
        return
      }
    }

    await supabase
      .from('orders')
      .update({
        client_verdict: verdict,
        status: statusMap[verdict],
        delivered_at: deliveredAt,
      })
      .eq('id', order.id)

    await saveNpsScore(session, nps as 0 | 1 | 2)
    await loadOrders(session)
  }

  if (!session) return null

  const activeOrder = pendingClientOrders[0]
  const withVerdict = clientOrders.filter(o => o.client_verdict)
  const ok = withVerdict.filter(o => o.client_verdict === 'ok').length
  const tarde = withVerdict.filter(o => o.client_verdict === 'tarde').length
  const perdidos = withVerdict.filter(o => o.client_verdict === 'no_entregado').length

  const pedidosHechosDb = uniqueSequenceCount(clientOrders)
  const pedidosHechos = Math.min(total, Math.max(pedidosHechosDb, currentIdx))
  const pedidosRestantes = Math.max(0, total - pedidosHechos)
  const nextProduct: Product | undefined = seq[Math.min(currentIdx, total - 1)]

  const activeHadStock = !!activeOrder?.notes?.includes('stock_disponible_al_pedir')
  const deliveredByWarehouse = !!activeOrder?.notes?.includes('entregado_por_almacen')

  return (
    <main style={{ padding: 16, maxWidth: 420, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <span className="badge badge-danger">🛒 CLIENTE — Línea {session.line}</span>
        <p className="small" style={{ marginTop: 4 }}>Vista privada — no mostrar a la empresa</p>
      </div>

      {msg && <div className="alert alert-info" style={{ marginBottom: 12 }}>{msg}</div>}

      <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#2563eb' }}>{pedidosHechos}/{total}</div>
            <div className="small">Pedidos hechos</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a' }}>{pedidosRestantes}</div>
            <div className="small">Pedidos restantes</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button
          onClick={() => setVista('activa')}
          style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: vista === 'activa' ? '#2563eb' : '#e0e7ff', color: vista === 'activa' ? 'white' : '#1e40af' }}
        >
          📦 Pedido actual
        </button>
        <button
          onClick={() => setVista('hoja')}
          style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: vista === 'hoja' ? '#2563eb' : '#e0e7ff', color: vista === 'hoja' ? 'white' : '#1e40af' }}
        >
          📋 Mis pedidos ({pedidosHechos}/{total})
        </button>
      </div>

      {vista === 'activa' && (
        <>
          {!running ? (
            demandFinished || currentIdx >= total ? (
              <div className="card" style={{ marginBottom: 14, textAlign: 'center', background: '#f0fdf4', borderColor: '#86efac' }}>
                <span className="badge badge-live">✅ Demanda finalizada</span>
                <h2 style={{ marginTop: 10 }}>Cliente completó {total} pedidos</h2>
                <p className="small">Ya no se generarán más pedidos. La producción puede seguir trabajando.</p>
                <button className="btn-full btn-danger" style={{ marginTop: 10 }} onClick={resetClientDemand}>
                  Reiniciar demanda del cliente
                </button>
              </div>
            ) : (
              <div className="card grid" style={{ marginBottom: 14 }}>
                <h2>Configurar demanda</h2>
                <p className="small">Línea {session.line} → Secuencia {session.line === 'A' ? 'T1' : 'T2'} · máximo {total} pedidos</p>

                <label>
                  Tiempo hasta el primer pedido (segundos)
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={firstIntervalSec}
                    onChange={e => setFirstIntervalSec(Number(e.target.value))}
                  />
                </label>

                <label>
                  Intervalo entre los siguientes pedidos (segundos)
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={intervalSec}
                    onChange={e => setIntervalSec(Number(e.target.value))}
                  />
                </label>

                <p className="small">Ejemplo: primer pedido en {firstIntervalSec}s; luego un pedido cada {intervalSec}s.</p>

                <button className="btn-full btn-success" style={{ fontSize: 18, minHeight: 56, marginTop: 8 }} onClick={startDemand}>
                  ▶ Iniciar demanda
                </button>

                {clientOrders.length > 0 && (
                  <button className="btn-full btn-danger" style={{ fontSize: 13 }} onClick={resetClientDemand}>
                    Reiniciar solo pedidos del cliente
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="card" style={{ marginBottom: 14, textAlign: 'center' }}>
              <span className="badge badge-live" style={{ marginBottom: 8 }}>● Demanda activa</span>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Pedidos hechos: <strong>{pedidosHechos}</strong> de <strong>{total}</strong></div>
              {nextProduct && <div style={{ fontSize: 52, fontWeight: 800, color: PRODUCT_COLOR[nextProduct], margin: '8px 0' }}>{nextProduct}</div>}
              <p className="small">{currentIdx === 0 ? 'Primer pedido en' : 'Próximo pedido en'}</p>
              <div style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#0f172a' }}>{nextIn}s</div>
              <button className="btn-ghost btn-full" style={{ marginTop: 10, fontSize: 13 }} onClick={stopDemand}>⏹ Pausar</button>
            </div>
          )}

          {activeOrder && (
            <div className="card grid" style={{ marginBottom: 14, borderColor: '#fca5a5', background: '#fff5f5' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Califica el pedido #{activeOrder.sequence_number}</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: PRODUCT_COLOR[activeOrder.product], margin: '6px 0' }}>{activeOrder.product}</div>
                {activeHadStock && <div className="alert alert-info">Había stock cuando pediste: cuando recibas físicamente, marca <strong>A tiempo</strong>.</div>}
                {!activeHadStock && !deliveredByWarehouse && <div className="alert alert-warn">No había stock al pedir. Si llega antes del siguiente pedido, marca <strong>Tarde</strong>.</div>}
                {deliveredByWarehouse && !activeHadStock && <div className="alert alert-info">Almacén ya lo entregó físicamente: marca <strong>Tarde</strong>.</div>}
                {deliveredByWarehouse && activeHadStock && <div className="alert alert-info">Almacén ya lo entregó físicamente: marca <strong>A tiempo</strong>.</div>}
              </div>
              <div className="grid-3" style={{ gap: 8 }}>
                <button disabled={!activeHadStock} style={{ background: activeHadStock ? '#16a34a' : '#94a3b8', color: 'white', border: 'none', borderRadius: 12, padding: '14px 4px', fontSize: 13, fontWeight: 700, cursor: activeHadStock ? 'pointer' : 'not-allowed' }} onClick={() => markVerdict(activeOrder, 'ok')}>
                  ✓<br />A tiempo
                </button>
                <button style={{ background: '#d97706', color: 'white', border: 'none', borderRadius: 12, padding: '14px 4px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={() => markVerdict(activeOrder, 'tarde')}>
                  ⚠<br />Tarde
                </button>
                <button style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 12, padding: '14px 4px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={() => markVerdict(activeOrder, 'no_entregado')}>
                  ✗<br />No recibí
                </button>
              </div>
              <p className="small text-center">A tiempo = había stock al pedir. Tarde = llegó antes del siguiente pedido. No recibí = no llegó.</p>
            </div>
          )}

          <div className="card">
            <div className="grid-3">
              <div className="metric good"><div className="val">{ok}</div><div className="lbl">A tiempo</div></div>
              <div className="metric warn"><div className="val">{tarde}</div><div className="lbl">Tarde</div></div>
              <div className="metric bad"><div className="val">{perdidos}</div><div className="lbl">No recibidos</div></div>
            </div>
          </div>
        </>
      )}

      {vista === 'hoja' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Mis pedidos</h2>
            <div className="grid-3" style={{ gap: 6 }}>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{ok}</div><div style={{ fontSize: 9, color: '#64748b' }}>OK</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 800, color: '#d97706' }}>{tarde}</div><div style={{ fontSize: 9, color: '#64748b' }}>Tarde</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 800, color: '#dc2626' }}>{perdidos}</div><div style={{ fontSize: 9, color: '#64748b' }}>No recibí</div></div>
            </div>
          </div>

          <div style={{ overflowY: 'auto', maxHeight: 420 }}>
            {seq.map((product, i) => {
              const num = i + 1
              const order = clientOrders.find(o => o.sequence_number === num && o.client_verdict) ||
                clientOrders.find(o => o.sequence_number === num && o.status === 'pendiente')
              const verdict = order?.client_verdict
              const isCurrent = num === currentIdx + 1 || pendingClientOrders.some(o => o.sequence_number === num)

              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 10, marginBottom: 4, background: isCurrent ? '#eff6ff' : '#f8fafc', border: `1.5px solid ${isCurrent ? '#3b82f6' : '#e2e8f0'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, minWidth: 24 }}>#{num}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: PRODUCT_COLOR[product] + '22', border: `1.5px solid ${PRODUCT_COLOR[product]}`, color: '#0f172a' }}>
                      {PRODUCT_LABEL[product]}
                    </span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{verdict === 'ok' ? '✓' : verdict === 'tarde' ? '⚠' : verdict === 'no_entregado' ? '✗' : isCurrent ? '👉' : '·'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </main>
  )
}
