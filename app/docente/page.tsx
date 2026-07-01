'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { getSession } from '../../lib/session'
import {
  ORDER_STATUS_LABEL, PRODUCT_COLOR,
  type Order, type OvenBatch, type NpsResponse, type Player, type Room,
} from '../../lib/types'
import { calcMetrics, playerStatus } from '../../lib/metrics'

type Tab = 'dashboard' | 'empresa' | 'cliente' | 'horno' | 'almacen' | 'jugadores' | 'resultado'

export default function DocentePage() {
  const [roomId, setRoomId]   = useState('OPEN2026')
  const [ordersA, setOrdersA] = useState<Order[]>([])
  const [ordersB, setOrdersB] = useState<Order[]>([])
  const [batchesA, setBatchesA] = useState<OvenBatch[]>([])
  const [batchesB, setBatchesB] = useState<OvenBatch[]>([])
  const [nps, setNps]         = useState<NpsResponse[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [room, setRoom]       = useState<Room | null>(null)
  const [tab, setTab]         = useState<Tab>('dashboard')
  const [msg, setMsg]         = useState('')
  const [tick, setTick]       = useState(0)

  const load = useCallback(async (rid: string) => {
    const [{ data: oA }, { data: oB }, { data: bA }, { data: bB }, { data: n }, { data: p }, { data: r }] =
      await Promise.all([
        supabase.from('orders').select('*').eq('room_id', rid).eq('line', 'A').order('sequence_number'),
        supabase.from('orders').select('*').eq('room_id', rid).eq('line', 'B').order('sequence_number'),
        supabase.from('oven_batches').select('*').eq('room_id', rid).eq('line', 'A').order('batch_number'),
        supabase.from('oven_batches').select('*').eq('room_id', rid).eq('line', 'B').order('batch_number'),
        supabase.from('nps_responses').select('*').eq('room_id', rid),
        supabase.from('players').select('*').eq('room_id', rid).order('connected_at'),
        supabase.from('rooms').select('*').eq('id', rid).single(),
      ])
    setOrdersA((oA || []) as Order[])
    setOrdersB((oB || []) as Order[])
    setBatchesA((bA || []) as OvenBatch[])
    setBatchesB((bB || []) as OvenBatch[])
    setNps((n || []) as NpsResponse[])
    setPlayers((p || []) as Player[])
    setRoom(r as Room)
  }, [])

  useEffect(() => {
    const s = getSession()
    if (s) setRoomId(s.roomId)
  }, [])

  useEffect(() => {
    load(roomId)
    const ch = supabase.channel('docente-' + roomId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders',
        filter: `room_id=eq.${roomId}` }, () => load(roomId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oven_batches',
        filter: `room_id=eq.${roomId}` }, () => load(roomId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players',
        filter: `room_id=eq.${roomId}` }, () => load(roomId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nps_responses',
        filter: `room_id=eq.${roomId}` }, () => load(roomId))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [roomId, load])

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 1000)
    return () => clearInterval(t)
  }, [])

  async function resetRoom() {
    if (!confirm(`¿Borrar TODOS los datos de la sala ${roomId}? No se puede deshacer.`)) return
    await Promise.all([
      supabase.from('orders').delete().eq('room_id', roomId),
      supabase.from('oven_batches').delete().eq('room_id', roomId),
      supabase.from('nps_responses').delete().eq('room_id', roomId),
      supabase.from('players').delete().eq('room_id', roomId),
    ])
    setMsg('Sala reiniciada correctamente.')
    load(roomId)
  }

  async function deleteOrder(id: string) {
    await supabase.from('orders').delete().eq('id', id)
    setMsg('Pedido eliminado.')
    load(roomId)
  }

  const batchSizeA = room?.oven_a_batch || 8
  const batchSizeB = room?.oven_b_batch || 4
  const mA      = calcMetrics(ordersA, batchesA, batchSizeA)
  const mB      = calcMetrics(ordersB, batchesB, batchSizeB)
  const ovenDur = room?.oven_duration_sec || 80

  // Timers del horno en tiempo real
  const ovenTimers: Record<string, number> = {}
  ;[...batchesA, ...batchesB]
    .filter(b => b.status === 'procesando' && b.started_at)
    .forEach(b => {
      const elapsed = (Date.now() - new Date(b.started_at!).getTime()) / 1000
      ovenTimers[b.id] = Math.max(0, ovenDur - elapsed)
    })

  const TABS: { id: Tab; label: string }[] = [
    { id: 'dashboard',  label: '📊 Dashboard'  },
    { id: 'empresa',    label: '🏭 Empresa'    },
    { id: 'cliente',    label: '🛒 Cliente'    },
    { id: 'horno',      label: '🔥 Horno'      },
    { id: 'almacen',    label: '📦 Almacén'    },
    { id: 'jugadores',  label: '👥 Jugadores'  },
    { id: 'resultado',  label: '🏆 Resultado'  },
  ]

  return (
    <main className="page">
      <div className="topbar">
        <div>
          <span className="badge">Docente</span>
          <h1 style={{ marginTop: 6, fontSize: 20 }}>Panel de Control</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>Sala:</span>
            <input value={roomId}
              onChange={e => { setRoomId(e.target.value.toUpperCase()); load(e.target.value.toUpperCase()) }}
              style={{ border: 'none', borderBottom: '2px solid #e2e8f0', background: 'transparent', fontSize: 14, fontWeight: 700, width: 100, outline: 'none' }} />
          </div>
        </div>
        <div className="topbar-actions">
          <a href="/empresa" className="btn btn-light" style={{ fontSize: 12, padding: '6px 12px', minHeight: 0 }}>
            📺 Proyector
          </a>
          <button className="btn btn-danger" style={{ fontSize: 12, padding: '6px 12px', minHeight: 0 }} onClick={resetRoom}>
            🗑 Reiniciar sala
          </button>
        </div>
      </div>

      {msg && (
        <div className="alert alert-success mb-12" onClick={() => setMsg('')}>
          {msg} <span style={{ fontSize: 11, color: '#64748b' }}>(toca para cerrar)</span>
        </div>
      )}

      <div className="tabs" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
        {TABS.map(t => (
          <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`}
            style={{ whiteSpace: 'nowrap' }} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && (
        <div className="grid">
          <div className="grid-2">
            <LineCard label="Línea A" color="#2563eb" metrics={mA} batchSize={batchSizeA} />
            <LineCard label="Línea B" color="#16a34a" metrics={mB} batchSize={batchSizeB} />
          </div>
          <div className="card">
            <h2>Últimos pedidos — Línea A</h2>
            <OrderTable orders={ordersA.slice(-8).reverse()} onDelete={deleteOrder} />
          </div>
          <div className="card">
            <h2>Últimos pedidos — Línea B</h2>
            <OrderTable orders={ordersB.slice(-8).reverse()} onDelete={deleteOrder} />
          </div>
        </div>
      )}

      {/* ── EMPRESA ── */}
      {tab === 'empresa' && (
        <div style={{ background: '#0f172a', borderRadius: 16, padding: 14 }}>
          <EmpresaView
            ordersA={ordersA} ordersB={ordersB}
            batchesA={batchesA} batchesB={batchesB}
            ovenTimers={ovenTimers} ovenDur={ovenDur} room={room}
            mA={mA} mB={mB}
          />
        </div>
      )}

      {/* ── CLIENTE ── */}
      {tab === 'cliente' && (
        <div className="grid">
          <div className="card">
            <h2>Cliente — Línea A (T1)</h2>
            <ClienteResumen orders={ordersA} />
          </div>
          <div className="card">
            <h2>Cliente — Línea B (T2)</h2>
            <ClienteResumen orders={ordersB} />
          </div>
        </div>
      )}

      {/* ── HORNO ── */}
      {tab === 'horno' && (
        <div className="grid-2">
          <div className="card">
            <h2>Horno A (lote {room?.oven_a_batch || 8})</h2>
            <HornoResumen batches={batchesA} orders={ordersA} ovenTimers={ovenTimers}
              batchSize={room?.oven_a_batch || 8} ovenDur={ovenDur} />
          </div>
          <div className="card">
            <h2>Horno B (lote {room?.oven_b_batch || 4})</h2>
            <HornoResumen batches={batchesB} orders={ordersB} ovenTimers={ovenTimers}
              batchSize={room?.oven_b_batch || 4} ovenDur={ovenDur} />
          </div>
        </div>
      )}

      {/* ── ALMACÉN ── */}
      {tab === 'almacen' && (
        <div className="grid-2">
          <div className="card">
            <h2>Almacén — Línea A</h2>
            <AlmacenResumen orders={ordersA} />
          </div>
          <div className="card">
            <h2>Almacén — Línea B</h2>
            <AlmacenResumen orders={ordersB} />
          </div>
        </div>
      )}

      {/* ── JUGADORES ── */}
      {tab === 'jugadores' && (
        <div className="card">
          <h2>Jugadores conectados ({players.length})</h2>
          <div className="table-wrap mt-12">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Línea</th>
                  <th>Rol</th>
                  <th>Estado actual</th>
                  <th>Hora</th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => {
                  const playerOrders  = p.line === 'A' ? ordersA : ordersB
                  const playerBatches = p.line === 'A' ? batchesA : batchesB
                  const estado        = playerStatus(p.role, playerOrders, playerBatches)
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>
                        <span className="badge" style={{
                          background: p.line === 'A' ? '#dbeafe' : '#dcfce7',
                          color:      p.line === 'A' ? '#1e40af' : '#166534',
                        }}>
                          Línea {p.line}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{p.role}</td>
                      <td style={{ fontSize: 12, color: '#2563eb' }}>{estado}</td>
                      <td className="small">{new Date(p.connected_at).toLocaleTimeString()}</td>
                    </tr>
                  )
                })}
                {players.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>Sin jugadores aún</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── RESULTADO ── */}
      {tab === 'resultado' && (
        <div className="grid">
          <div className="winner-card">
            <div className="title">GANADORA</div>
            <div className="name">
              Línea {mB.cumplimiento >= mA.cumplimiento ? 'B' : 'A'}
            </div>
            <div style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
              {Math.abs(mB.cumplimiento - mA.cumplimiento)} puntos de diferencia en cumplimiento
            </div>
          </div>
          <div className="grid-2">
            {[
              { label: 'Cumplimiento',        a: mA.cumplimiento + '%', b: mB.cumplimiento + '%' },
              { label: 'A tiempo',            a: mA.ok,                 b: mB.ok                 },
              { label: 'Tarde',               a: mA.tarde,              b: mB.tarde              },
              { label: 'Ventas perdidas',     a: mA.noEntregado,        b: mB.noEntregado        },
              { label: 'Tiempo promedio',     a: mA.avgCycleLabel,      b: mB.avgCycleLabel      },
              { label: 'Primeras 8 entregas', a: mA.first8,             b: mB.first8             },
              { label: 'Primer lote',         a: mA.firstBatch,         b: mB.firstBatch         },
              { label: 'Promedio por lote',   a: mA.avgLot,             b: mB.avgLot             },
              { label: 'Satisfacción (NPS)',  a: mA.npsAvg + '/2',      b: mB.npsAvg + '/2'      },
              { label: 'Cuello de botella',   a: mA.bottleneck,         b: mB.bottleneck         },
            ].map(row => (
              <div key={row.label} className="card" style={{ padding: 12 }}>
                <div className="small mb-8">{row.label}</div>
                <div className="flex-between">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#2563eb' }}>{row.a}</div>
                    <div className="small">Línea A</div>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 11 }}>vs</div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>{row.b}</div>
                    <div className="small">Línea B</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}

// ─── SUB-COMPONENTES ──────────────────────────────────────────────────────────

function LineCard({ label, color, metrics: m, batchSize }: {
  label: string, color: string, metrics: ReturnType<typeof calcMetrics>, batchSize: number,
}) {
  return (
    <div className="card">
      <div className="flex-between mb-12">
        <div style={{ fontSize: 15, fontWeight: 700, color }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{m.cumplimiento}%</div>
      </div>
      <div className="grid-3" style={{ gap: 8 }}>
        <div className="metric good"><div className="val">{m.ok}</div><div className="lbl">A tiempo</div></div>
        <div className="metric warn"><div className="val">{m.tarde}</div><div className="lbl">Tarde</div></div>
        <div className="metric bad"><div className="val">{m.noEntregado}</div><div className="lbl">Perdidas</div></div>
        <div className="metric"><div className="val">{m.total}</div><div className="lbl">Pedidos</div></div>
        <div className="metric"><div className="val">{m.first8}</div><div className="lbl">Primeras 8</div></div>
        <div className="metric"><div className="val">{m.firstBatch}</div><div className="lbl">Primer lote</div></div>
        <div className="metric"><div className="val">{m.avgLot}</div><div className="lbl">Prom. lote {batchSize}</div></div>
        <div className="metric"><div className="val">{m.productionLots.length}</div><div className="lbl">Lotes salidos</div></div>
        <div className="metric"><div className="val">{m.enAlmacen}</div><div className="lbl">Stock</div></div>
      </div>
      {m.bottleneck !== '-' && (
        <div className="alert alert-warn mt-8" style={{ fontSize: 12 }}>
          ⚠ Cuello de botella: <strong>{m.bottleneck}</strong>
        </div>
      )}
      {m.productionLots.length > 0 && (
        <div className="card" style={{ marginTop: 10, padding: 10, background: '#f8fafc' }}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Salidas de lotes</div>
          <div className="grid" style={{ gap: 6 }}>
            {m.productionLots.slice(-5).map((lot) => (
              <div key={lot.lotNumber} className="flex-between" style={{ fontSize: 12 }}>
                <span>Lote {lot.lotNumber} · {lot.quantity} productos</span>
                <strong>{lot.durationLabel}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

function OrderTable({ orders, onDelete }: { orders: Order[], onDelete: (id: string) => void }) {
  return (
    <div className="table-wrap mt-8">
      <table>
        <thead>
          <tr><th>#</th><th>Producto</th><th>Estado</th><th>Veredicto</th><th>Hora</th><th></th></tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td>{o.sequence_number}</td>
              <td>{o.product}</td>
              <td><span className={`status ${o.status}`}>{ORDER_STATUS_LABEL[o.status]}</span></td>
              <td style={{ fontSize: 12 }}>{o.client_verdict || '—'}</td>
              <td className="small">{new Date(o.requested_at).toLocaleTimeString()}</td>
              <td>
                <button onClick={() => onDelete(o.id)}
                  style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, minHeight: 0, padding: 4 }}>
                  🗑
                </button>
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8' }}>Sin pedidos</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function ClienteResumen({ orders }: { orders: Order[] }) {
  const ok       = orders.filter(o => o.client_verdict === 'ok').length
  const tarde    = orders.filter(o => o.client_verdict === 'tarde').length
  const perdidos = orders.filter(o => o.client_verdict === 'no_entregado').length
  const sinCal   = orders.filter(o => !o.client_verdict && o.status !== 'pendiente')
  return (
    <div className="grid mt-8">
      <div className="grid-3" style={{ gap: 8 }}>
        <div className="metric good"><div className="val">{ok}</div><div className="lbl">A tiempo</div></div>
        <div className="metric warn"><div className="val">{tarde}</div><div className="lbl">Tarde</div></div>
        <div className="metric bad"><div className="val">{perdidos}</div><div className="lbl">Perdidos</div></div>
      </div>
      {sinCal.length > 0 && (
        <div>
          <p className="small mb-8">Sin calificar aún:</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {sinCal.map(o => (
              <span key={o.id} style={{
                padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                background: PRODUCT_COLOR[o.product] + '22',
                border: `1px solid ${PRODUCT_COLOR[o.product]}`,
              }}>
                #{o.sequence_number} {o.product}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function HornoResumen({ batches, orders, ovenTimers, batchSize, ovenDur }: {
  batches: OvenBatch[], orders: Order[], ovenTimers: Record<string, number>,
  batchSize: number, ovenDur: number,
}) {
  const active    = batches.find(b => b.status === 'procesando')
  const ready     = batches.find(b => b.status === 'listo')
  const waiting   = orders.filter(o => ['ensamble2_listo','esperando_horno','en_horno'].includes(o.status))
  const remaining = active ? (ovenTimers[active.id] ?? null) : null

  return (
    <div className="grid mt-8">
      <div style={{
        borderRadius: 12, padding: 12,
        border: `2px solid ${ready ? '#16a34a' : active ? '#dc2626' : '#e2e8f0'}`,
        background:   ready ? '#f0fdf4' : active ? '#fff5f5' : '#f8fafc',
      }}>
        <div className="flex-between">
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Lote mínimo: {batchSize} · {ovenDur}s</div>
            <div style={{ display: 'flex', gap: 3, marginTop: 6, flexWrap: 'wrap' }}>
              {Array.from({ length: batchSize }).map((_, i) => (
                <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: i < waiting.length ? '#2563eb' : '#e2e8f0' }} />
              ))}
            </div>
          </div>
          {remaining !== null ? (
            <div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
              {String(Math.floor(remaining / 60)).padStart(2,'0')}:{String(Math.round(remaining) % 60).padStart(2,'0')}
            </div>
          ) : ready ? (
            <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>¡Listo!</div>
          ) : (
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Vacío</div>
          )}
        </div>
      </div>
      <p className="small">
        {waiting.length} en zona horno · {batches.filter(b => b.status === 'liberado').length} lotes completados
      </p>
    </div>
  )
}

function AlmacenResumen({ orders }: { orders: Order[] }) {
  const enAlmacen = orders.filter(o => o.status === 'en_almacen')
  return (
    <div className="grid mt-8">
      <div className="metric"><div className="val">{enAlmacen.length}</div><div className="lbl">En stock ahora</div></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {enAlmacen.map(o => (
          <span key={o.id} style={{
            padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 700,
            background: PRODUCT_COLOR[o.product] + '22',
            border: `1px solid ${PRODUCT_COLOR[o.product]}`,
          }}>
            #{o.sequence_number} {o.product}
          </span>
        ))}
        {enAlmacen.length === 0 && <p className="small">Almacén vacío</p>}
      </div>
      <div className="grid-3" style={{ gap: 8 }}>
        <div className="metric good"><div className="val">{orders.filter(o => o.status === 'entregado_ok').length}</div><div className="lbl">Entregados</div></div>
        <div className="metric warn"><div className="val">{orders.filter(o => o.status === 'entregado_tarde').length}</div><div className="lbl">Tarde</div></div>
        <div className="metric bad"><div className="val">{orders.filter(o => o.status === 'no_entregado').length}</div><div className="lbl">Perdidos</div></div>
      </div>
    </div>
  )
}

function EmpresaView({ ordersA, ordersB, batchesA, batchesB, ovenTimers, ovenDur, room, mA, mB }: {
  ordersA: Order[], ordersB: Order[], batchesA: OvenBatch[], batchesB: OvenBatch[],
  ovenTimers: Record<string, number>, ovenDur: number, room: Room | null,
  mA: ReturnType<typeof calcMetrics>, mB: ReturnType<typeof calcMetrics>,
}) {
  const lines = [
    { label: 'Línea A', color: '#3b82f6', orders: ordersA, batches: batchesA, m: mA, batchSize: room?.oven_a_batch || 8 },
    { label: 'Línea B', color: '#16a34a', orders: ordersB, batches: batchesB, m: mB, batchSize: room?.oven_b_batch || 4 },
  ]
  return (
    <div style={{ color: 'white' }}>
      <div className="flex-between" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Vista Empresa — En vivo</div>
        <span className="badge badge-live">● Live</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {lines.map(({ label, color, orders, batches, m, batchSize }) => {
          const active    = batches.find(b => b.status === 'procesando')
          const ready     = batches.find(b => b.status === 'listo')
          const remaining = active ? (ovenTimers[active.id] ?? null) : null
          const stations  = [
            { n: 'E1',      c: orders.filter(o => ['en_planificacion','ensamble1'].includes(o.status)).length },
            { n: 'E2',      c: orders.filter(o => ['ensamble1_listo','ensamble2'].includes(o.status)).length },
            { n: 'Horno',   c: orders.filter(o => ['ensamble2_listo','esperando_horno','en_horno'].includes(o.status)).length },
            { n: 'Almacén', c: orders.filter(o => o.status === 'en_almacen').length },
          ]
          return (
            <div key={label} style={{ background: '#1e293b', borderRadius: 12, padding: 12 }}>
              <div className="flex-between" style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 800, color, fontSize: 14 }}>{label}</div>
                <div style={{ fontWeight: 800, fontSize: 20 }}>{m.cumplimiento}%</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, marginBottom: 10 }}>
                {[
                  { v: m.ok,          l: 'A tiempo', c: '#4ade80', bg: '#052e16' },
                  { v: m.tarde,       l: 'Tarde',    c: '#fb923c', bg: '#431407' },
                  { v: m.noEntregado, l: 'Perdidas', c: '#fca5a5', bg: '#7f1d1d' },
                ].map(item => (
                  <div key={item.l} style={{ background: item.bg, borderRadius: 6, padding: '5px 4px', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: item.c }}>{item.v}</div>
                    <div style={{ fontSize: 9, color: item.c }}>{item.l}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 10 }}>
                {stations.map((s, i) => (
                  <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{
                        height: 36, borderRadius: 6, fontSize: 15, fontWeight: 800, color: 'white',
                        border: `2px solid ${s.c > 2 ? '#dc2626' : s.c > 0 ? color : '#334155'}`,
                        background: s.c > 2 ? '#7f1d1d' : s.c > 0 ? '#1e3a5f' : '#0f172a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{s.c}</div>
                      <div style={{ fontSize: 8, color: '#64748b', marginTop: 2 }}>{s.n}</div>
                    </div>
                    {i < stations.length - 1 && <div style={{ color: '#475569', fontSize: 10 }}>›</div>}
                  </div>
                ))}
              </div>
              <div style={{
                borderRadius: 8, padding: 8,
                border: `2px solid ${ready ? '#16a34a' : active ? '#dc2626' : '#334155'}`,
                background:   ready ? '#052e16' : active ? '#7f1d1d' : '#0f172a',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Lote: {batchSize} · {ovenDur}s</div>
                  <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                    {Array.from({ length: batchSize }).map((_, i) => {
                      const filled = orders.filter(o => ['en_horno','esperando_horno','ensamble2_listo'].includes(o.status)).length
                      return <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: ready ? '#16a34a' : i < filled ? color : '#334155' }} />
                    })}
                  </div>
                </div>
                {remaining !== null ? (
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                    {String(Math.floor(remaining / 60)).padStart(2,'0')}:{String(Math.round(remaining) % 60).padStart(2,'0')}
                  </div>
                ) : ready ? (
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#16a34a' }}>¡Listo!</div>
                ) : (
                  <div style={{ fontSize: 12, color: '#475569' }}>—</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
