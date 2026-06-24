'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { getSession } from '../../lib/session'
import { type Order, type NpsResponse, type Room, type Player } from '../../lib/types'
import { calcMetrics } from '../../lib/metrics'

export default function DocentePage() {
  const [roomId, setRoomId] = useState('OPEN2026')
  const [ordersA, setOrdersA] = useState<Order[]>([])
  const [ordersB, setOrdersB] = useState<Order[]>([])
  const [nps, setNps] = useState<NpsResponse[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [room, setRoom] = useState<Room | null>(null)
  const [tab, setTab] = useState<'live' | 'resultado' | 'jugadores' | 'config'>('live')
  const [msg, setMsg] = useState('')
  const [tick, setTick] = useState(0)

  const load = useCallback(async (rid: string) => {
    const [{ data: oA }, { data: oB }, { data: n }, { data: p }, { data: r }] = await Promise.all([
      supabase.from('orders').select('*').eq('room_id', rid).eq('line', 'A').order('sequence_number'),
      supabase.from('orders').select('*').eq('room_id', rid).eq('line', 'B').order('sequence_number'),
      supabase.from('nps_responses').select('*').eq('room_id', rid),
      supabase.from('players').select('*').eq('room_id', rid).order('connected_at'),
      supabase.from('rooms').select('*').eq('id', rid).single(),
    ])
    setOrdersA((oA || []) as Order[])
    setOrdersB((oB || []) as Order[])
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `room_id=eq.${roomId}` }, () => load(roomId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nps_responses', filter: `room_id=eq.${roomId}` }, () => load(roomId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, () => load(roomId))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [roomId, load])

  useEffect(() => { const t = setInterval(() => setTick(p => p + 1), 1000); return () => clearInterval(t) }, [])

  async function resetRoom() {
    if (!confirm(`¿Borrar TODOS los pedidos y jugadores de sala ${roomId}? No se puede deshacer.`)) return
    await Promise.all([
      supabase.from('orders').delete().eq('room_id', roomId),
      supabase.from('oven_batches').delete().eq('room_id', roomId),
      supabase.from('nps_responses').delete().eq('room_id', roomId),
      supabase.from('players').delete().eq('room_id', roomId),
    ])
    await supabase.from('rooms').update({ status: 'waiting', started_at: null, finished_at: null }).eq('id', roomId)
    setMsg('Sala reiniciada correctamente.')
    load(roomId)
  }

  async function deleteOrder(id: string) {
    await supabase.from('orders').delete().eq('id', id)
    setMsg('Pedido eliminado.')
    load(roomId)
  }

  const mA = calcMetrics(ordersA)
  const mB = calcMetrics(ordersB)
  const npsA = nps.filter(n => n.line === 'A')
  const npsB = nps.filter(n => n.line === 'B')
  const avgNpsA = npsA.length ? (npsA.reduce((s, n) => s + n.score, 0) / npsA.length).toFixed(1) : '-'
  const avgNpsB = npsB.length ? (npsB.reduce((s, n) => s + n.score, 0) / npsB.length).toFixed(1) : '-'

  const lineaGanadora = mA.cumplimiento >= mB.cumplimiento ? 'A' : 'B'

  return (
    <main className="page">
      <div className="topbar">
        <div>
          <span className="badge">Docente / Facilitador</span>
          <h1 style={{ marginTop: 6 }}>Panel de Control</h1>
          <p>Sala: <input value={roomId} onChange={e => setRoomId(e.target.value.toUpperCase())}
            style={{ border: 'none', borderBottom: '2px solid #e2e8f0', background: 'transparent', fontSize: 14, fontWeight: 700, width: 100, outline: 'none' }} /></p>
        </div>
        <div className="topbar-actions">
          <a href="/empresa" className="btn btn-light" style={{ fontSize: 13, padding: '8px 14px', minHeight: 0 }}>📺 Proyector</a>
          <button className="btn btn-danger" style={{ fontSize: 13, padding: '8px 14px', minHeight: 0 }} onClick={resetRoom}>🗑 Reiniciar sala</button>
        </div>
      </div>

      {msg && <div className="alert alert-success mb-12" onClick={() => setMsg('')}>{msg} (clic para cerrar)</div>}

      <div className="tabs">
        {([['live','📊 En vivo'],['resultado','🏆 Resultado'],['jugadores','👥 Jugadores'],['config','⚙ Config']] as const).map(([t, l]) => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{l}</div>
        ))}
      </div>

      {tab === 'live' && (
        <div className="grid">
          <div className="grid-2">
            <LineCard label="Línea A" color="#2563eb" subtitle="Horno estándar" metrics={mA} npsAvg={avgNpsA} />
            <LineCard label="Línea B" color="#16a34a" subtitle="Horno mejorado" metrics={mB} npsAvg={avgNpsB} />
          </div>

          <div className="card">
            <h2>Pedidos en vivo — Línea A</h2>
            <OrderTable orders={ordersA.slice(-10).reverse()} onDelete={deleteOrder} />
          </div>
          <div className="card">
            <h2>Pedidos en vivo — Línea B</h2>
            <OrderTable orders={ordersB.slice(-10).reverse()} onDelete={deleteOrder} />
          </div>
        </div>
      )}

      {tab === 'resultado' && (
        <div className="grid">
          <div className="winner-card">
            <div className="title">GANADORA</div>
            <div className="name">Línea {lineaGanadora} — {lineaGanadora === 'A' ? 'Horno estándar' : 'Horno mejorado'}</div>
            <div style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
              {Math.abs(mB.cumplimiento - mA.cumplimiento)} puntos porcentuales de diferencia en cumplimiento
            </div>
          </div>

          <div className="grid-2">
            {[
              { label: 'Cumplimiento A vs B', a: mA.cumplimiento + '%', b: mB.cumplimiento + '%' },
              { label: 'A tiempo', a: mA.ok, b: mB.ok },
              { label: 'Tarde', a: mA.tarde, b: mB.tarde },
              { label: 'Ventas perdidas', a: mA.noEntregado, b: mB.noEntregado },
              { label: 'Tiempo promedio', a: mA.avgCycleLabel, b: mB.avgCycleLabel },
              { label: 'Primeras 8 entregas', a: mA.first8, b: mB.first8 },
              { label: 'Satisfacción cliente', a: avgNpsA + '/2', b: avgNpsB + '/2' },
              { label: 'Cuello de botella', a: mA.bottleneck, b: mB.bottleneck },
            ].map(row => (
              <div key={row.label} className="card" style={{ padding: 14 }}>
                <div className="small mb-8">{row.label}</div>
                <div className="flex-between">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb' }}>{row.a}</div>
                    <div className="small">Línea A</div>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>vs</div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{row.b}</div>
                    <div className="small">Línea B</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'jugadores' && (
        <div className="card">
          <h2>Jugadores conectados ({players.length})</h2>
          <div className="table-wrap mt-12">
            <table>
              <thead><tr><th>Nombre</th><th>Línea</th><th>Rol</th><th>Conectado</th></tr></thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><span className="badge" style={{ background: p.line === 'A' ? '#dbeafe' : '#dcfce7', color: p.line === 'A' ? '#1e40af' : '#166534' }}>Línea {p.line}</span></td>
                    <td style={{ fontSize: 13 }}>{p.role}</td>
                    <td className="small">{new Date(p.connected_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
                {players.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8' }}>No hay jugadores aún</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'config' && room && (
        <div className="card grid">
          <h2>Configuración de sala</h2>
          <div className="grid-2">
            <div className="metric"><div className="val">{room.demand_interval_sec}s</div><div className="lbl">Intervalo demanda</div></div>
            <div className="metric"><div className="val">{room.oven_duration_sec}s</div><div className="lbl">Duración horno</div></div>
            <div className="metric"><div className="val">{room.oven_a_batch}</div><div className="lbl">Lote Horno A</div></div>
            <div className="metric"><div className="val">{room.oven_b_batch}</div><div className="lbl">Lote Horno B</div></div>
          </div>
          <p className="small">La configuración la hace el Cliente desde su vista antes de iniciar la demanda.</p>
          <button className="btn btn-danger btn-full" onClick={resetRoom}>🗑 Reiniciar sala completa</button>
        </div>
      )}
    </main>
  )
}

function LineCard({ label, color, subtitle, metrics: m, npsAvg }: {
  label: string, color: string, subtitle: string, metrics: ReturnType<typeof calcMetrics>, npsAvg: string
}) {
  return (
    <div className="card">
      <div className="flex-between mb-12">
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color }}>{label}</div>
          <div className="small">{subtitle}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{m.cumplimiento}%</div>
          <div className="small">Cumplimiento</div>
        </div>
      </div>
      <div className="grid-3" style={{ gap: 8 }}>
        <div className="metric good"><div className="val">{m.ok}</div><div className="lbl">A tiempo</div></div>
        <div className="metric warn"><div className="val">{m.tarde}</div><div className="lbl">Tarde</div></div>
        <div className="metric bad"><div className="val">{m.noEntregado}</div><div className="lbl">Perdidas</div></div>
        <div className="metric"><div className="val">{m.total}</div><div className="lbl">Pedidos</div></div>
        <div className="metric"><div className="val">{m.first8}</div><div className="lbl">Primeras 8</div></div>
        <div className="metric"><div className="val">{npsAvg}/2</div><div className="lbl">Satisfacción</div></div>
      </div>
      {m.bottleneck !== '-' && (
        <div className="alert alert-warn mt-8" style={{ fontSize: 12 }}>
          ⚠ Cuello de botella: <strong>{m.bottleneck}</strong>
        </div>
      )}
    </div>
  )
}

function OrderTable({ orders, onDelete }: { orders: Order[], onDelete: (id: string) => void }) {
  const STATUS_LABEL: Record<string, string> = {
    pendiente: 'Pendiente', en_planificacion: 'Planif.', ensamble1: 'E1', ensamble1_listo: 'E1✓',
    ensamble2: 'E2', ensamble2_listo: 'E2✓', esperando_horno: 'Esp.Horno', en_horno: '🔥Horno',
    en_almacen: 'Almacén', entregado_ok: '✓OK', entregado_tarde: '⚠Tarde', no_entregado: '✗Perdido',
  }
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Producto</th><th>Estado</th><th>Veredicto</th><th>Hora</th><th></th></tr></thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td>{o.sequence_number}</td>
              <td>{o.product}</td>
              <td><span className={`status ${o.status}`}>{STATUS_LABEL[o.status] || o.status}</span></td>
              <td>{o.client_verdict || '-'}</td>
              <td className="small">{new Date(o.requested_at).toLocaleTimeString()}</td>
              <td><button onClick={() => onDelete(o.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, minHeight: 0, padding: 4 }}>🗑</button></td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8' }}>Sin pedidos</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
