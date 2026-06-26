'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { PRODUCT_COLOR, type Order, type OvenBatch, type Room } from '../../lib/types'
import { calcMetrics } from '../../lib/metrics'

export default function EmpresaPage() {
  const [roomId, setRoomId]     = useState('OPEN2026')
  const [ordersA, setOrdersA]   = useState<Order[]>([])
  const [ordersB, setOrdersB]   = useState<Order[]>([])
  const [batchesA, setBatchesA] = useState<OvenBatch[]>([])
  const [batchesB, setBatchesB] = useState<OvenBatch[]>([])
  const [room, setRoom]         = useState<Room | null>(null)
  const [tick, setTick]         = useState(0)
  const [ovenTimers, setOvenTimers] = useState<Record<string, number>>({})

  const loadData = useCallback(async (rid: string) => {
    const [{ data: oA }, { data: oB }, { data: bA }, { data: bB }, { data: r }] = await Promise.all([
      supabase.from('orders').select('*').eq('room_id', rid).eq('line', 'A').order('sequence_number'),
      supabase.from('orders').select('*').eq('room_id', rid).eq('line', 'B').order('sequence_number'),
      supabase.from('oven_batches').select('*').eq('room_id', rid).eq('line', 'A').order('batch_number'),
      supabase.from('oven_batches').select('*').eq('room_id', rid).eq('line', 'B').order('batch_number'),
      supabase.from('rooms').select('*').eq('id', rid).single(),
    ])
    setOrdersA((oA || []) as Order[])
    setOrdersB((oB || []) as Order[])
    setBatchesA((bA || []) as OvenBatch[])
    setBatchesB((bB || []) as OvenBatch[])
    setRoom(r as Room)
  }, [])

  useEffect(() => {
    loadData(roomId)
    const ch = supabase.channel('empresa-' + roomId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders',
        filter: `room_id=eq.${roomId}` }, () => loadData(roomId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oven_batches',
        filter: `room_id=eq.${roomId}` }, () => loadData(roomId))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [roomId, loadData])

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const dur = room?.oven_duration_sec || 80
    const timers: Record<string, number> = {}
    ;[...batchesA, ...batchesB]
      .filter(b => b.status === 'procesando' && b.started_at)
      .forEach(b => {
        const elapsed = (Date.now() - new Date(b.started_at!).getTime()) / 1000
        timers[b.id]  = Math.max(0, dur - elapsed)
      })
    setOvenTimers(timers)
  }, [tick, batchesA, batchesB, room])

  const mA      = calcMetrics(ordersA, batchesA)
  const mB      = calcMetrics(ordersB, batchesB)
  const ovenDur = room?.oven_duration_sec || 80

  const lines = [
    { label: 'Línea A', color: '#3b82f6', orders: ordersA, batches: batchesA, m: mA, batchSize: room?.oven_a_batch || 8 },
    { label: 'Línea B', color: '#16a34a', orders: ordersB, batches: batchesB, m: mB, batchSize: room?.oven_b_batch || 4 },
  ]

  return (
    <main style={{ padding: 16, background: '#0f172a', minHeight: '100vh', color: 'white' }}>
      <div className="topbar" style={{ marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>Sala</div>
          <input value={roomId} onChange={e => setRoomId(e.target.value.toUpperCase())}
            style={{ background: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: 10, padding: '6px 12px', fontSize: 16, width: 130 }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>🏭 Production Line Live</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Vista Empresa — En vivo</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="/docente" style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, background: '#1e293b', color: '#94a3b8' }}>
            Docente →
          </a>
          <span className="badge badge-live">● Live</span>
        </div>
      </div>

      {/* Alerta cuello de botella */}
      {(mA.bottleneck !== '-' || mB.bottleneck !== '-') && (
        <div style={{ background: '#7c2d12', border: '1px solid #ea580c', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
          ⚠
          {mA.bottleneck !== '-' && <span> <strong>Línea A</strong>: cuello en <strong>{mA.bottleneck}</strong></span>}
          {mA.bottleneck !== '-' && mB.bottleneck !== '-' && ' · '}
          {mB.bottleneck !== '-' && <span> <strong>Línea B</strong>: cuello en <strong>{mB.bottleneck}</strong></span>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
          const recent = [...orders]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 10)

          return (
            <div key={label} style={{ background: '#1e293b', borderRadius: 16, padding: 14 }}>
              {/* Cabecera */}
              <div className="flex-between" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color }}>{label}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{m.cumplimiento}%</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Cumplimiento</div>
                </div>
              </div>

              {/* Métricas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 12 }}>
                {[
                  { v: m.ok,          l: 'A tiempo',  c: '#4ade80', bg: '#052e16' },
                  { v: m.tarde,       l: 'Tarde',     c: '#fb923c', bg: '#431407' },
                  { v: m.noEntregado, l: 'Perdidas',  c: '#fca5a5', bg: '#7f1d1d' },
                  { v: m.total,       l: 'Pedidos',   c: '#94a3b8', bg: '#0f172a' },
                  { v: m.enLinea,     l: 'En línea',  c: '#60a5fa', bg: '#0f172a' },
                  { v: m.first8,      l: 'Primeras 8',c: '#a78bfa', bg: '#0f172a' },
                ].map(item => (
                  <div key={item.l} style={{ background: item.bg, borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: item.c }}>{item.v}</div>
                    <div style={{ fontSize: 9, color: '#64748b' }}>{item.l}</div>
                  </div>
                ))}
              </div>

              {/* Pipeline */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 12 }}>
                {stations.map((s, i) => (
                  <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{
                        height: 44, borderRadius: 8,
                        border: `2px solid ${s.c > 2 ? '#dc2626' : s.c > 0 ? color : '#334155'}`,
                        background: s.c > 2 ? '#7f1d1d' : s.c > 0 ? '#1e3a5f' : '#0f172a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 800, color: 'white',
                      }}>{s.c}</div>
                      <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{s.n}</div>
                    </div>
                    {i < stations.length - 1 && <div style={{ color: '#475569', fontSize: 12 }}>›</div>}
                  </div>
                ))}
              </div>

              {/* Horno */}
              <div style={{
                borderRadius: 10, padding: 10, marginBottom: 10,
                border: `2px solid ${ready ? '#16a34a' : active ? '#dc2626' : '#334155'}`,
                background:   ready ? '#052e16' : active ? '#7f1d1d' : '#0f172a',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>🔥 Lote: {batchSize} · {ovenDur}s</div>
                  <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                    {Array.from({ length: batchSize }).map((_, i) => {
                      const filled = orders.filter(o =>
                        ['en_horno','esperando_horno','ensamble2_listo'].includes(o.status)
                      ).length
                      return <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: ready ? '#16a34a' : i < filled ? color : '#334155' }} />
                    })}
                  </div>
                </div>
                {remaining !== null ? (
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                    {String(Math.floor(remaining / 60)).padStart(2,'0')}:{String(Math.round(remaining) % 60).padStart(2,'0')}
                  </div>
                ) : ready ? (
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>¡Listo!</div>
                ) : (
                  <div style={{ fontSize: 12, color: '#475569' }}>Vacío</div>
                )}
              </div>

              {/* Productos recientes */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {recent.map(o => (
                  <div key={o.id} title={`#${o.sequence_number} ${o.product}`} style={{
                    width: 24, height: 24, borderRadius: 5,
                    background: PRODUCT_COLOR[o.product] + '33',
                    border: `2px solid ${PRODUCT_COLOR[o.product]}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700, color: 'white',
                    opacity: ['entregado_ok','entregado_tarde','no_entregado'].includes(o.status) ? 0.4 : 1,
                  }}>
                    {o.product[0]}
                  </div>
                ))}
                {orders.length === 0 && <span style={{ fontSize: 11, color: '#475569' }}>Sin pedidos aún</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Comparación al pie */}
      {(ordersA.length > 0 || ordersB.length > 0) && (
        <div style={{ marginTop: 14, background: '#1e293b', borderRadius: 14, padding: 14 }}>
          <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 10 }}>
            COMPARACIÓN
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {[
              { label: 'Cumplimiento',    a: mA.cumplimiento + '%', b: mB.cumplimiento + '%' },
              { label: 'Perdidas',        a: mA.noEntregado,        b: mB.noEntregado        },
              { label: 'Primeras 8',      a: mA.first8,             b: mB.first8             },
              { label: 'Primer lote',     a: mA.firstBatch,         b: mB.firstBatch         },
            ].map(c => (
              <div key={c.label} style={{ background: '#0f172a', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>{c.label}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#3b82f6', fontWeight: 700, fontSize: 13 }}>{c.a}</span>
                  <span style={{ fontSize: 10, color: '#64748b' }}>vs</span>
                  <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 13 }}>{c.b}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
