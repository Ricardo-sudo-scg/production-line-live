'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { getSession, clearSession } from '../../lib/session'
import {
  ORDER_STATUS_LABEL, PLAN_422, PLAN_844, PRODUCT_COLOR, PRODUCT_LABEL,
  type Order, type OvenBatch, type PlayerSession, type Product, type Room,
} from '../../lib/types'

function ProductPill({ p }: { p: string }) {
  const map: Record<string, string> = { Bicolor: 'pill-bc', Amarillo: 'pill-am', Rojo: 'pill-r' }
  const short: Record<string, string> = { Bicolor: 'Bc', Amarillo: 'Am', Rojo: 'R' }
  return <span className={map[p] || ''}>{short[p] || p}</span>
}

export default function PlayPage() {
  const [session, setSession] = useState<PlayerSession | null>(null)
  const [orders, setOrders]   = useState<Order[]>([])
  const [batches, setBatches] = useState<OvenBatch[]>([])
  const [room, setRoom]       = useState<Room | null>(null)
  const [msg, setMsg]         = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const s = getSession()
    if (!s) { window.location.href = '/'; return }
    setSession(s)
  }, [])

  const loadData = useCallback(async (s: PlayerSession) => {
    const [{ data: o }, { data: b }, { data: r }] = await Promise.all([
      supabase.from('orders').select('*').eq('room_id', s.roomId).eq('line', s.line).order('sequence_number'),
      supabase.from('oven_batches').select('*').eq('room_id', s.roomId).eq('line', s.line).order('batch_number'),
      supabase.from('rooms').select('*').eq('id', s.roomId).single(),
    ])
    setOrders((o || []) as Order[])
    setBatches((b || []) as OvenBatch[])
    setRoom(r as Room)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!session) return
    loadData(session)
    const ch = supabase.channel('play-' + session.roomId + session.line)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders',
        filter: `room_id=eq.${session.roomId}` }, () => loadData(session))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oven_batches',
        filter: `room_id=eq.${session.roomId}` }, () => loadData(session))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms',
        filter: `id=eq.${session.roomId}` }, () => loadData(session))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session, loadData])

  async function update(id: string, data: Partial<Order>) {
    setMsg('')
    const { error } = await supabase.from('orders').update(data).eq('id', id)
    if (error) setMsg(error.message)
  }

  if (!session) return null

  const lineColor = session.line === 'A' ? '#2563eb' : '#16a34a'

  return (
    <main style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <div className="topbar" style={{ marginBottom: 12 }}>
        <div>
          <span className="badge" style={{ background: lineColor, color: 'white' }}>Línea {session.line}</span>
          <h2 style={{ marginTop: 6, fontSize: 15 }}>{session.role}</h2>
          <p className="small">{session.name} · Sala {session.roomId}</p>
        </div>
        <button className="btn-ghost" style={{ fontSize: 12, padding: '7px 12px', minHeight: 0 }}
          onClick={() => { clearSession(); window.location.href = '/' }}>Salir</button>
      </div>

      {msg && <div className="alert alert-danger">{msg}</div>}
      {loading && <p className="small">Cargando...</p>}

      {!loading && (
        <>
          {session.role === 'Jefe de Planificación Estratégica' &&
            <PlanificadorPanel orders={orders} session={session} onUpdate={update} />}
          {session.role === 'Técnico de Fabricación Alpha' &&
            <Ensamble1Panel orders={orders} onUpdate={update} />}
          {session.role === 'Técnico de Fabricación Beta' &&
            <Ensamble2Panel orders={orders} onUpdate={update} />}
          {session.role === 'Ingeniero de Procesos Térmicos' &&
            <HornoPanel orders={orders} batches={batches} session={session} room={room} setMsg={setMsg} />}
          {session.role === 'Gerente de Logística y Distribución' &&
            <AlmacenPanel orders={orders} onUpdate={update} />}
          {session.role === 'Coordinador de Materiales' &&
            <ReciclajePanel orders={orders} />}
        </>
      )}
    </main>
  )
}

// ─── PLANIFICADOR ────────────────────────────────────────────────────────────
function PlanificadorPanel({ orders, session, onUpdate }: {
  orders: Order[], session: PlayerSession,
  onUpdate: (id: string, d: Partial<Order>) => void,
}) {
  const plan      = session.line === 'A' ? PLAN_844 : PLAN_422
  const batchSize = session.line === 'A' ? 8 : 4
  const planName  = session.line === 'A' ? '8:4:4' : '4:2:2'

  // Cuántos productos ya fueron ordenados a producir
  const ordered = orders.filter(o => o.status !== 'pendiente').length
  // Calcular qué lote va (cuántos lotes completos ya se ordenaron)
  const lotesOrdenados = Math.floor(ordered / batchSize)

  async function ordenarLote() {
    // Crear los productos del siguiente lote como pedidos de producción
    const startIdx   = lotesOrdenados * batchSize
    const loteActual = plan.slice(startIdx % plan.length, (startIdx % plan.length) + batchSize)
    const now        = new Date().toISOString()
    await Promise.all(
      loteActual.map((product, i) =>
        supabase.from('orders').insert({
          room_id:          session.roomId,
          line:             session.line,
          sequence_number:  startIdx + i + 1,
          product,
          status:           'en_planificacion',
          requested_at:     now,
          planificacion_start: now,
        })
      )
    )
  }

  const pendientes  = orders.filter(o => o.status === 'pendiente')
  const enProceso   = orders.filter(o => !['pendiente','entregado_ok','entregado_tarde','no_entregado'].includes(o.status))
  const entregados  = orders.filter(o => ['entregado_ok','entregado_tarde'].includes(o.status))

  return (
    <div className="grid">
      <div className="card">
        <h2>Plan de producción — {planName}</h2>
        <p className="small" style={{ marginTop: 4 }}>
          Lote de {batchSize} · se repite indefinidamente
        </p>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Patrón del lote:</div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {plan.map((p, i) => (
              <div key={i} title={p} style={{
                width: 20, height: 20, borderRadius: 4,
                background: i < ordered % plan.length ? PRODUCT_COLOR[p as Product] : PRODUCT_COLOR[p as Product] + '44',
                border: `2px solid ${PRODUCT_COLOR[p as Product]}`,
                position: 'relative',
              }}>
                {i < ordered % plan.length && (
                  <span style={{ position: 'absolute', top: -2, left: 2, fontSize: 10, color: 'white', fontWeight: 800 }}>✓</span>
                )}
              </div>
            ))}
          </div>
          <p className="small mt-8">
            Lotes ordenados: <strong>{lotesOrdenados}</strong> · Productos en línea: <strong>{enProceso.length}</strong>
          </p>
        </div>
      </div>

      <button className="btn-full btn-xl" style={{ background: '#2563eb' }} onClick={ordenarLote}>
        📋 Ordenar lote {lotesOrdenados + 1} ({batchSize} productos)
      </button>

      <div className="grid-3">
        <div className="metric"><div className="val">{enProceso.length}</div><div className="lbl">En línea</div></div>
        <div className="metric good"><div className="val">{entregados.length}</div><div className="lbl">Entregados</div></div>
        <div className="metric bad"><div className="val">{orders.filter(o => o.status === 'no_entregado').length}</div><div className="lbl">Perdidos</div></div>
      </div>

      {pendientes.length > 0 && (
        <div className="card">
          <h3>Pendientes del cliente ({pendientes.length})</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {pendientes.map(o => <ProductPill key={o.id} p={o.product} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ENSAMBLE 1 ──────────────────────────────────────────────────────────────
function Ensamble1Panel({ orders, onUpdate }: {
  orders: Order[], onUpdate: (id: string, d: Partial<Order>) => void,
}) {
  const disponibles = orders.filter(o => o.status === 'en_planificacion' || o.status === 'ensamble1')
  return (
    <div className="grid">
      <div className="alert alert-info">
        Arma la <strong>primera parte</strong> del producto con LEGO y registra aquí.
      </div>
      {disponibles.length === 0 && (
        <div className="card text-center"><p>Esperando pedidos del Planificador...</p></div>
      )}
      {disponibles.map(o => (
        <div key={o.id} className={`order-card ${o.status === 'ensamble1' ? 'urgent' : ''}`}>
          <div className="order-row">
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              #{o.sequence_number} <ProductPill p={o.product} />
            </div>
            <span className="status">{ORDER_STATUS_LABEL[o.status]}</span>
          </div>
          {o.status === 'en_planificacion' && (
            <button className="btn-full" onClick={() =>
              onUpdate(o.id, { status: 'ensamble1', ensamble1_start: new Date().toISOString() })}>
              ▶ Iniciar armado
            </button>
          )}
          {o.status === 'ensamble1' && (
            <button className="btn-full btn-success" onClick={() =>
              onUpdate(o.id, { status: 'ensamble1_listo', ensamble1_end: new Date().toISOString() })}>
              ✓ Listo — Enviar a Ensamble 2
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── ENSAMBLE 2 ──────────────────────────────────────────────────────────────
function Ensamble2Panel({ orders, onUpdate }: {
  orders: Order[], onUpdate: (id: string, d: Partial<Order>) => void,
}) {
  const disponibles = orders.filter(o => o.status === 'ensamble1_listo' || o.status === 'ensamble2')
  return (
    <div className="grid">
      <div className="alert alert-info">
        Recibe de Ensamble 1 y completa la <strong>segunda parte</strong> del armado.
      </div>
      {disponibles.length === 0 && (
        <div className="card text-center"><p>Esperando productos de Ensamble 1...</p></div>
      )}
      {disponibles.map(o => (
        <div key={o.id} className={`order-card ${o.status === 'ensamble2' ? 'urgent' : ''}`}>
          <div className="order-row">
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              #{o.sequence_number} <ProductPill p={o.product} />
            </div>
            <span className="status">{ORDER_STATUS_LABEL[o.status]}</span>
          </div>
          {o.status === 'ensamble1_listo' && (
            <button className="btn-full" onClick={() =>
              onUpdate(o.id, { status: 'ensamble2', ensamble2_start: new Date().toISOString() })}>
              ▶ Iniciar segunda parte
            </button>
          )}
          {o.status === 'ensamble2' && (
            <button className="btn-full btn-success" onClick={() =>
              onUpdate(o.id, { status: 'ensamble2_listo', ensamble2_end: new Date().toISOString() })}>
              ✓ Listo — Enviar al Horno
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── HORNO ───────────────────────────────────────────────────────────────────
function HornoPanel({ orders, batches, session, room, setMsg }: {
  orders: Order[], batches: OvenBatch[], session: PlayerSession,
  room: Room | null, setMsg: (s: string) => void,
}) {
  const [ovenTime, setOvenTime] = useState<Record<string, number>>({})
  const batchSize   = session.line === 'A' ? (room?.oven_a_batch || 8) : (room?.oven_b_batch || 4)
  const ovenDuration = room?.oven_duration_sec || 80

  useEffect(() => {
    const interval = setInterval(() => {
      const processing = batches.filter(b => b.status === 'procesando')
      const newTimes: Record<string, number> = {}
      processing.forEach(b => {
        if (b.started_at) {
          const elapsed = (Date.now() - new Date(b.started_at).getTime()) / 1000
          newTimes[b.id] = Math.max(0, ovenDuration - elapsed)
        }
      })
      setOvenTime(newTimes)
    }, 500)
    return () => clearInterval(interval)
  }, [batches, ovenDuration])

  const readyOrders  = orders.filter(o => o.status === 'ensamble2_listo' || o.status === 'esperando_horno')
  const activeBatch  = batches.find(b => b.status === 'procesando')
  const readyBatches = batches.filter(b => b.status === 'listo')

  async function startOven() {
    if (readyOrders.length < batchSize) {
      setMsg(`Necesitas ${batchSize} productos para iniciar el horno`)
      return
    }
    const batchNum = (batches.length > 0 ? Math.max(...batches.map(b => b.batch_number)) : 0) + 1
    const now      = new Date().toISOString()
    const readyAt  = new Date(Date.now() + ovenDuration * 1000).toISOString()

    const { data: batch, error } = await supabase.from('oven_batches').insert({
      room_id:      session.roomId,
      line:         session.line,
      batch_number: batchNum,
      status:       'procesando',
      started_at:   now,
      ready_at:     readyAt,
    }).select().single()

    if (error || !batch) { setMsg(error?.message || 'Error al iniciar horno'); return }

    const toProcess = readyOrders.slice(0, batchSize)
    await Promise.all(toProcess.map(o =>
      supabase.from('orders').update({ status: 'en_horno', horno_entry: now }).eq('id', o.id)
    ))

    // Liberación automática al terminar los 80 segundos
    setTimeout(async () => {
      const exitTime = new Date().toISOString()
      await supabase.from('oven_batches').update({ status: 'liberado', released_at: exitTime }).eq('id', batch.id)
      await Promise.all(toProcess.map(o =>
        supabase.from('orders').update({
          status:       'en_almacen',
          horno_exit:   exitTime,
          almacen_entry: exitTime,
        }).eq('id', o.id)
      ))
    }, ovenDuration * 1000)
  }

  return (
    <div className="grid">
      <div className={`oven-box ${activeBatch?.status === 'procesando' ? 'processing' : readyBatches.length > 0 ? 'ready' : ''}`}>
        <div className="flex-between">
          <div>
            <h3>🔥 Horno {session.line}</h3>
            <p className="small">Lote: {batchSize} · {ovenDuration} segundos · libera automático</p>
          </div>
          {activeBatch?.status === 'procesando' && ovenTime[activeBatch.id] !== undefined ? (
            <div>
              <div className="oven-timer red">
                {String(Math.floor(ovenTime[activeBatch.id] / 60)).padStart(2,'0')}:{String(Math.round(ovenTime[activeBatch.id]) % 60).padStart(2,'0')}
              </div>
              <div className="progress" style={{ width: 100 }}>
                <div className="progress-fill" style={{ width: `${((ovenDuration - ovenTime[activeBatch.id]) / ovenDuration) * 100}%` }} />
              </div>
            </div>
          ) : (
            <div className="oven-timer" style={{ color: 'var(--muted)', fontSize: 18 }}>
              {readyBatches.length > 0 ? '¡Listo!' : 'Vacío'}
            </div>
          )}
        </div>

        <div className="lote-dots" style={{ marginTop: 10 }}>
          {Array.from({ length: batchSize }).map((_, i) => (
            <div key={i} className={`lote-dot ${
              i < readyOrders.length
                ? (activeBatch ? 'filled' : 'done')
                : ''
            }`} />
          ))}
        </div>
        <p className="small mt-8">{readyOrders.length} / {batchSize} productos listos para entrar</p>
      </div>

      {activeBatch?.status === 'procesando' && (
        <div className="alert alert-warn">
          El horno está procesando. Se liberará automáticamente al terminar.
        </div>
      )}

      {!activeBatch && readyOrders.length >= batchSize && (
        <button className="btn-full btn-xl" onClick={startOven}>
          🔥 Iniciar Horno — {batchSize} productos
        </button>
      )}

      {!activeBatch && readyOrders.length < batchSize && readyOrders.length > 0 && (
        <div className="alert alert-info">
          Esperando {batchSize - readyOrders.length} producto(s) más para completar el lote.
        </div>
      )}

      <div className="card">
        <h3>En espera del horno ({readyOrders.length})</h3>
        <div className="flex" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {readyOrders.map(o => <span key={o.id}><ProductPill p={o.product} /></span>)}
          {readyOrders.length === 0 && <p className="small">Nada en espera</p>}
        </div>
      </div>

      <div className="card">
        <h3>Lotes procesados: {batches.filter(b => b.status === 'liberado').length}</h3>
      </div>
    </div>
  )
}

// ─── ALMACÉN ─────────────────────────────────────────────────────────────────
function AlmacenPanel({ orders, onUpdate }: {
  orders: Order[], onUpdate: (id: string, d: Partial<Order>) => void,
}) {
  const enAlmacen = orders.filter(o => o.status === 'en_almacen')
  return (
    <div className="grid">
      <div className="alert alert-info">
        Cuando el cliente pida un producto, entrégaselo físicamente y regístralo aquí.
      </div>
      {enAlmacen.length === 0 && (
        <div className="card text-center"><p>No hay productos en almacén aún.</p></div>
      )}
      {enAlmacen.map(o => (
        <div key={o.id} className="order-card">
          <div className="order-row">
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              #{o.sequence_number} <ProductPill p={o.product} />
            </div>
          </div>
          <div className="grid-2" style={{ gap: 8 }}>
            <button className="btn-success" style={{ fontSize: 13, minHeight: 44 }}
              onClick={() => onUpdate(o.id, { status: 'entregado_ok', delivered_at: new Date().toISOString() })}>
              ✓ Entregado a tiempo
            </button>
            <button className="btn-warning" style={{ fontSize: 13, minHeight: 44 }}
              onClick={() => onUpdate(o.id, { status: 'entregado_tarde', delivered_at: new Date().toISOString() })}>
              ⚠ Entregado tarde
            </button>
          </div>
          <button className="btn-full btn-danger" style={{ fontSize: 12, minHeight: 38, marginTop: 6 }}
            onClick={() => onUpdate(o.id, { status: 'no_entregado', delivered_at: new Date().toISOString() })}>
            ✗ No entregado
          </button>
        </div>
      ))}
      <div className="card">
        <div className="grid-3">
          <div className="metric good"><div className="val">{orders.filter(o => o.status === 'entregado_ok').length}</div><div className="lbl">A tiempo</div></div>
          <div className="metric warn"><div className="val">{orders.filter(o => o.status === 'entregado_tarde').length}</div><div className="lbl">Tarde</div></div>
          <div className="metric bad"><div className="val">{orders.filter(o => o.status === 'no_entregado').length}</div><div className="lbl">Perdidos</div></div>
        </div>
      </div>
    </div>
  )
}

// ─── RECICLAJE ────────────────────────────────────────────────────────────────
function ReciclajePanel({ orders }: { orders: Order[] }) {
  const delivered = orders.filter(o =>
    ['entregado_ok','entregado_tarde','no_entregado'].includes(o.status)
  )
  return (
    <div className="grid">
      <div className="alert alert-info">
        Recoge los productos entregados, desármalos y devuelve las piezas al área de materiales.
      </div>
      <div className="card">
        <h3>Productos para reciclar ({delivered.length})</h3>
        <div className="flex" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {delivered.map(o => <span key={o.id}><ProductPill p={o.product} /></span>)}
        </div>
        {delivered.length === 0 && <p className="small mt-8">Aún no hay productos para reciclar.</p>}
      </div>
      <div className="card">
        <p className="small">Tu rol es clave: sin piezas recicladas, la línea se queda sin materiales.</p>
      </div>
    </div>
  )
}
