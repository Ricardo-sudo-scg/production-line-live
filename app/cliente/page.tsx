'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { getSession } from '../../lib/session'
import { DEMAND_SEQUENCE_T1, DEMAND_SEQUENCE_T2, type Order, type PlayerSession, type Product, type Room } from '../../lib/types'

const PRODUCT_COLOR: Record<Product, string> = { Bicolor: '#3b82f6', Amarillo: '#eab308', Rojo: '#ef4444' }

export default function ClientePage() {
  const [session, setSession] = useState<PlayerSession | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [currentPedidoIdx, setCurrentPedidoIdx] = useState(0)
  const [nextIn, setNextIn] = useState(0)
  const [running, setRunning] = useState(false)
  const [interval, setIntervalSec] = useState(20)
  const [sequence, setSequence] = useState<'T1' | 'T2'>('T1')
  const [npsSubmitted, setNpsSubmitted] = useState(false)
  const [msg, setMsg] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const s = getSession()
    if (!s || s.role !== 'Cliente') { window.location.href = '/'; return }
    setSession(s)
  }, [])

  const loadData = useCallback(async (s: PlayerSession) => {
    const [{ data: r }, { data: o }] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', s.roomId).single(),
      supabase.from('orders').select('*').eq('room_id', s.roomId).eq('line', s.line).order('sequence_number'),
    ])
    setRoom(r as Room)
    setOrders((o || []) as Order[])
  }, [])

  useEffect(() => {
    if (!session) return
    loadData(session)
    const ch = supabase.channel('cliente-' + session.roomId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `room_id=eq.${session.roomId}` }, () => loadData(session))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session, loadData])

  const seq = sequence === 'T1' ? DEMAND_SEQUENCE_T1 : DEMAND_SEQUENCE_T2

  function startDemand() {
    if (!session) return
    setRunning(true)
    setNextIn(interval)

    countdownRef.current = setInterval(() => {
      setNextIn(prev => {
        if (prev <= 1) return interval
        return prev - 1
      })
    }, 1000)

    timerRef.current = setInterval(async () => {
      setCurrentPedidoIdx(prev => {
        const idx = prev
        if (idx >= seq.length) {
          stopDemand()
          return prev
        }
        const product = seq[idx]
        supabase.from('orders').insert({
          room_id: session!.roomId,
          line: session!.line,
          sequence_number: idx + 1,
          product,
          status: 'pendiente',
          requested_at: new Date().toISOString(),
        })
        return idx + 1
      })
    }, interval * 1000)
  }

  function stopDemand() {
    setRunning(false)
    if (timerRef.current) clearInterval(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }

  useEffect(() => () => { stopDemand() }, [])

  async function markVerdict(orderId: string, verdict: 'ok' | 'tarde' | 'no_entregado') {
    const statusMap = { ok: 'entregado_ok', tarde: 'entregado_tarde', no_entregado: 'no_entregado' }
    await supabase.from('orders').update({
      client_verdict: verdict,
      status: statusMap[verdict],
      delivered_at: new Date().toISOString(),
    }).eq('id', orderId)
  }

  async function submitNps(score: number) {
    if (!session) return
    await supabase.from('nps_responses').insert({ room_id: session.roomId, line: session.line, score })
    setNpsSubmitted(true)
  }

  if (!session) return null

  const pendingVerdicts = orders.filter(o => !o.client_verdict && o.status !== 'pendiente')
  const withVerdict = orders.filter(o => o.client_verdict)
  const ok = withVerdict.filter(o => o.client_verdict === 'ok').length
  const tarde = withVerdict.filter(o => o.client_verdict === 'tarde').length
  const noEnt = withVerdict.filter(o => o.client_verdict === 'no_entregado').length
  const nextProduct = seq[currentPedidoIdx]

  return (
    <main style={{ padding: 16, maxWidth: 420, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <span className="badge badge-danger">🛒 CLIENTE EXTERNO</span>
        <h1 style={{ fontSize: 20, marginTop: 8 }}>Línea {session.line}</h1>
        <p className="small">Vista privada — no mostrar a la empresa</p>
      </div>

      {msg && <div className="alert alert-danger">{msg}</div>}

      {!running ? (
        <div className="card grid" style={{ marginBottom: 16 }}>
          <h2>Configurar demanda</h2>
          <label>
            Intervalo entre pedidos (segundos)
            <input type="number" min={5} max={120} value={interval}
              onChange={e => setIntervalSec(Number(e.target.value))} />
          </label>
          <label>
            Secuencia de pedidos
            <select value={sequence} onChange={e => setSequence(e.target.value as 'T1' | 'T2')}>
              <option value="T1">Temporada 1 (40 pedidos)</option>
              <option value="T2">Temporada 2 (40 pedidos)</option>
            </select>
          </label>
          <button className="btn-full btn-xl btn-success" onClick={startDemand}>
            ▶ Iniciar demanda
          </button>
          <p className="small text-center">Los pedidos se generarán automáticamente cada {interval} segundos.</p>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
          <div className="badge badge-live" style={{ marginBottom: 8 }}>● Demanda activa</div>
          <div style={{ fontSize: 48, fontWeight: 800, color: nextProduct ? PRODUCT_COLOR[nextProduct] : '#64748b', margin: '12px 0' }}>
            {nextProduct || '—'}
          </div>
          <p className="small">Pedido #{currentPedidoIdx + 1} de {seq.length}</p>
          <div style={{ marginTop: 12 }}>
            <p className="small">Próximo pedido en:</p>
            <div style={{ fontSize: 32, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{nextIn}s</div>
          </div>
          <button className="btn-ghost btn-full" style={{ marginTop: 12, fontSize: 13 }} onClick={stopDemand}>
            ⏹ Pausar demanda
          </button>
        </div>
      )}

      {pendingVerdicts.length > 0 && (
        <div className="card grid" style={{ marginBottom: 16 }}>
          <h2>Pedidos para calificar ({pendingVerdicts.length})</h2>
          {pendingVerdicts.map(o => (
            <div key={o.id} className="order-card">
              <div className="order-row">
                <div style={{ fontWeight: 700 }}>
                  #{o.sequence_number}
                  <span style={{ marginLeft: 8, display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: PRODUCT_COLOR[o.product], verticalAlign: 'middle' }} />
                  {' '}{o.product}
                </div>
              </div>
              <div className="grid-3" style={{ gap: 6 }}>
                <button className="btn-success" style={{ fontSize: 12, minHeight: 40, padding: '8px 4px' }} onClick={() => markVerdict(o.id, 'ok')}>
                  ✓ A tiempo
                </button>
                <button className="btn-warning" style={{ fontSize: 12, minHeight: 40, padding: '8px 4px' }} onClick={() => markVerdict(o.id, 'tarde')}>
                  ⚠ Tarde
                </button>
                <button className="btn-danger" style={{ fontSize: 12, minHeight: 40, padding: '8px 4px' }} onClick={() => markVerdict(o.id, 'no_entregado')}>
                  ✗ No recibí
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card grid" style={{ marginBottom: 16 }}>
        <h3>Mi registro</h3>
        <div className="grid-3">
          <div className="metric good"><div className="val">{ok}</div><div className="lbl">A tiempo</div></div>
          <div className="metric warn"><div className="val">{tarde}</div><div className="lbl">Tarde</div></div>
          <div className="metric bad"><div className="val">{noEnt}</div><div className="lbl">No recibí</div></div>
        </div>
      </div>

      {withVerdict.length >= 10 && !npsSubmitted && (
        <div className="card grid" style={{ marginBottom: 16 }}>
          <h2 style={{ textAlign: 'center' }}>¿Qué tan satisfecho estás?</h2>
          <p className="text-center">Como cliente, ¿cómo calificarías el servicio recibido?</p>
          <div className="nps-row">
            <button className="nps-btn s0" onClick={() => submitNps(0)}>😞<br /><span style={{ fontSize: 12 }}>Insatisfecho</span></button>
            <button className="nps-btn s1" onClick={() => submitNps(1)}>😐<br /><span style={{ fontSize: 12 }}>Regular</span></button>
            <button className="nps-btn s2" onClick={() => submitNps(2)}>😊<br /><span style={{ fontSize: 12 }}>Satisfecho</span></button>
          </div>
        </div>
      )}
      {npsSubmitted && <div className="alert alert-success text-center">¡Gracias! Tu satisfacción fue registrada.</div>}
    </main>
  )
}
