'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { ORDER_STATUS_LABEL, PRODUCT_COLOR, type Order, type OvenBatch, type Room } from '../../lib/types'
import { calcMetrics } from '../../lib/metrics'

export default function EmpresaPage() {
  const [roomId, setRoomId] = useState('OPEN2026')
  const [ordersA, setOrdersA] = useState<Order[]>([])
  const [ordersB, setOrdersB] = useState<Order[]>([])
  const [batchesA, setBatchesA] = useState<OvenBatch[]>([])
  const [batchesB, setBatchesB] = useState<OvenBatch[]>([])
  const [room, setRoom] = useState<Room | null>(null)
  const [ovenTimers, setOvenTimers] = useState<Record<string, number>>({})
  const [tick, setTick] = useState(0)

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `room_id=eq.${roomId}` }, () => loadData(roomId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oven_batches', filter: `room_id=eq.${roomId}` }, () => loadData(roomId))
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
    ;[...batchesA, ...batchesB].filter(b => b.status === 'procesando' && b.started_at).forEach(b => {
      const elapsed = (Date.now() - new Date(b.started_at!).getTime()) / 1000
      timers[b.id] = Math.max(0, dur - elapsed)
    })
    setOvenTimers(timers)
  }, [tick, batchesA, batchesB, room])

  const mA = calcMetrics(ordersA)
  const mB = calcMetrics(ordersB)
  const ovenDur = room?.oven_duration_sec || 80

  return (
    <main style={{ padding: 16, background: '#0f172a', minHeight: '100vh', color: 'white' }}>
      <div className="topbar" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>Sala</div>
          <input value={roomId} onChange={e => setRoomId(e.target.value.toUpperCase())}
            style={{ background: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: 10, padding: '6px 12px', fontSize: 16, width: 140 }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>🏭 Production Line Live</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Vista Empresa — En vivo</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/docente" style={{ fontSize: 13, padding: '8px 14px', borderRadius: 10, background: '#1e293b', color: '#94a3b8', display: 'inline-block' }}>Docente →</a>
          <span className="badge badge-live">● Live</span>
        </div>
      </div>

      {/* ALERTA CUELLO DE BOTELLA */}
      {(mA.bottleneck !== '-' || mB.bottleneck !== '-') && (
        <div style={{ background: '#7c2d12', border: '1px solid #ea580c', borderRadius: 14, padding: '10px 16px', marginBottom: 16, fontSize: 14 }}>
          ⚠
          {mA.bottleneck !== '-' && <span> <strong>Línea A</strong>: cuello de botella en <strong>{mA.bottleneck}</strong> ({mA.stationQueues[mA.bottleneck as keyof typeof mA.stationQueues]} esperando)</span>}
          {mA.bottleneck !== '-' && mB.bottleneck !== '-' && ' · '}
          {mB.bottleneck !== '-' && <span> <strong>Línea B</strong>: cuello de botella en <strong>{mB.bottleneck}</strong></span>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <LinePanel label="Línea A" color="#3b82f6" subtitle="Horno estándar" orders={ordersA} batches={batchesA} metrics={mA} ovenTimers={ovenTimers} ovenDur={ovenDur} batchSize={room?.oven_a_batch || 8} />
        <LinePanel label="Línea B" color="#16a34a" subtitle="Horno mejorado" orders={ordersB} batches={batchesB} metrics={mB} ovenTimers={ovenTimers} ovenDur={ovenDur} batchSize={room?.oven_b_batch || 4} />
      </div>

      {/* COMPARACION */}
      {(ordersA.length > 0 || ordersB.length > 0) && (
        <div style={{ marginTop: 16, background: '#1e293b', borderRadius: 16, padding: 16 }}>
          <div style={{ textAlign: 'center', marginBottom: 12, fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>
            COMPARACIÓN EN VIVO
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { label: 'Cumplimiento', a: mA.cumplimiento + '%', b: mB.cumplimiento + '%', better: mB.cumplimiento >= mA.cumplimiento ? 'B' : 'A' },
              { label: 'Ventas perdidas', a: mA.noEntregado, b: mB.noEntregado, better: mB.noEntregado <= mA.noEntregado ? 'B' : 'A' },
              { label: 'Tiempo promedio', a: mA.avgCycleLabel, b: mB.avgCycleLabel, better: 'B' },
              { label: 'Primeras 8', a: mA.first8, b: mB.first8, better: 'B' },
            ].map(c => (
              <div key={c.label} style={{ background: '#0f172a', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>{c.label}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#3b82f6', fontWeight: 700 }}>{c.a}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>vs</span>
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>{c.b}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: c.better === 'B' ? '#16a34a' : '#3b82f6' }}>
                  ▲ Línea {c.better} gana
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}

function LinePanel({ label, color, subtitle, orders, batches, metrics: m, ovenTimers, ovenDur, batchSize }: {
  label: string, color: string, subtitle: string, orders: Order[], batches: OvenBatch[],
  metrics: ReturnType<typeof calcMetrics>, ovenTimers: Record<string, number>, ovenDur: number, batchSize: number
}) {
  const activeBatch = batches.find(b => b.status === 'procesando')
  const readyBatch = batches.find(b => b.status === 'listo')
  const remaining = activeBatch ? (ovenTimers[activeBatch.id] ?? null) : null

  const stationsData = [
    { name: 'Plan.', count: orders.filter(o => ['pendiente','en_planificacion'].includes(o.status)).length },
    { name: 'Ensam.1', count: orders.filter(o => ['ensamble1','ensamble1_listo'].includes(o.status)).length },
    { name: 'Ensam.2', count: orders.filter(o => ['ensamble2','ensamble2_listo'].includes(o.status)).length },
    { name: 'Horno', count: orders.filter(o => ['esperando_horno','en_horno'].includes(o.status)).length },
    { name: 'Almacén', count: orders.filter(o => o.status === 'en_almacen').length },
  ]

  const recent = [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8)

  return (
    <div style={{ background: '#1e293b', borderRadius: 18, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color }}>{label}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{subtitle}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{m.cumplimiento}%</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Cumplimiento</div>
        </div>
      </div>

      {/* METRICAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { v: m.ok, l: 'A tiempo', c: '#16a34a' },
          { v: m.tarde, l: 'Tarde', c: '#d97706' },
          { v: m.noEntregado, l: 'Perdidas', c: '#dc2626' },
          { v: m.total, l: 'Pedidos', c: '#94a3b8' },
          { v: m.enLinea, l: 'En línea', c: '#3b82f6' },
          { v: m.first8, l: 'Primeras 8', c: '#a78bfa' },
        ].map(item => (
          <div key={item.l} style={{ background: '#0f172a', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: item.c }}>{item.v}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{item.l}</div>
          </div>
        ))}
      </div>

      {/* PIPELINE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14, overflowX: 'auto' }}>
        {stationsData.map((s, i) => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ textAlign: 'center', minWidth: 56 }}>
              <div style={{
                width: 56, height: 48, borderRadius: 10, border: `2px solid ${s.count > 2 ? '#dc2626' : s.count > 0 ? color : '#334155'}`,
                background: s.count > 2 ? '#7f1d1d' : s.count > 0 ? '#1e3a5f' : '#0f172a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 800, color: s.count > 0 ? 'white' : '#475569'
              }}>
                {s.count}
              </div>
              <div style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>{s.name}</div>
            </div>
            {i < stationsData.length - 1 && <div style={{ color: '#475569', fontSize: 14 }}>›</div>}
          </div>
        ))}
      </div>

      {/* HORNO */}
      <div style={{
        borderRadius: 12, padding: 12, marginBottom: 14,
        border: `2px solid ${readyBatch ? '#16a34a' : activeBatch ? '#dc2626' : '#334155'}`,
        background: readyBatch ? '#052e16' : activeBatch ? '#7f1d1d' : '#0f172a',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>🔥 Horno</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Lote: {batchSize} · {ovenDur}s</div>
            <div style={{ display: 'flex', gap: 3, marginTop: 6, flexWrap: 'wrap' }}>
              {Array.from({ length: batchSize }).map((_, i) => {
                const inOven = orders.filter(o => o.status === 'en_horno').length
                const waiting = orders.filter(o => ['ensamble2_listo','esperando_horno'].includes(o.status)).length
                const filled = inOven > 0 ? i < inOven : i < waiting
                const done = readyBatch && i < batchSize
                return <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: done ? '#16a34a' : filled ? color : '#334155' }} />
              })}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {remaining !== null ? (
              <>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                  {String(Math.floor(remaining / 60)).padStart(2,'0')}:{String(Math.round(remaining) % 60).padStart(2,'0')}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>procesando</div>
              </>
            ) : readyBatch ? (
              <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>¡Listo!</div>
            ) : (
              <div style={{ fontSize: 13, color: '#475569' }}>—</div>
            )}
          </div>
        </div>
      </div>

      {/* PRODUCTOS RECIENTES */}
      <div>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>ÚLTIMOS PEDIDOS</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {recent.map(o => (
            <div key={o.id} title={`#${o.sequence_number} ${o.product} — ${ORDER_STATUS_LABEL[o.status]}`}
              style={{
                width: 28, height: 28, borderRadius: 6, fontSize: 9, fontWeight: 700,
                background: PRODUCT_COLOR[o.product] + '33',
                border: `2px solid ${PRODUCT_COLOR[o.product]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                opacity: ['entregado_ok','entregado_tarde','no_entregado'].includes(o.status) ? 0.5 : 1,
              }}>
              {o.product[0]}
            </div>
          ))}
          {orders.length === 0 && <span style={{ fontSize: 12, color: '#475569' }}>Sin pedidos aún</span>}
        </div>
      </div>
    </div>
  )
}
