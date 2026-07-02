'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PRODUCT_COLOR, type Order, type OvenBatch, type Room } from '../../lib/types'
import { calcMetrics } from '../../lib/metrics'

export default function EmpresaPage() {
  const [roomId, setRoomId] = useState('OPEN2026')
  const [ordersA, setOrdersA] = useState<Order[]>([])
  const [ordersB, setOrdersB] = useState<Order[]>([])
  const [batchesA, setBatchesA] = useState<OvenBatch[]>([])
  const [batchesB, setBatchesB] = useState<OvenBatch[]>([])
  const [room, setRoom] = useState<Room | null>(null)
  const [tick, setTick] = useState(0)
  const [ovenTimers, setOvenTimers] = useState<Record<string, number>>({})

  const loadData = useCallback(async (rid: string) => {
    const cleanRoomId = rid.trim().toUpperCase()

    const [{ data: oA }, { data: oB }, { data: bA }, { data: bB }, { data: r }] =
      await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .eq('room_id', cleanRoomId)
          .eq('line', 'A')
          .order('sequence_number'),
        supabase
          .from('orders')
          .select('*')
          .eq('room_id', cleanRoomId)
          .eq('line', 'B')
          .order('sequence_number'),
        supabase
          .from('oven_batches')
          .select('*')
          .eq('room_id', cleanRoomId)
          .eq('line', 'A')
          .order('batch_number'),
        supabase
          .from('oven_batches')
          .select('*')
          .eq('room_id', cleanRoomId)
          .eq('line', 'B')
          .order('batch_number'),
        supabase.from('rooms').select('*').eq('id', cleanRoomId).single(),
      ])

    setOrdersA((oA || []) as Order[])
    setOrdersB((oB || []) as Order[])
    setBatchesA((bA || []) as OvenBatch[])
    setBatchesB((bB || []) as OvenBatch[])
    setRoom(r as Room)
  }, [])

  useEffect(() => {
    let active = true

    const refresh = () => {
      if (active) loadData(roomId)
    }

    refresh()

    const polling = setInterval(refresh, 1500)

    const ch = supabase
      .channel('empresa-' + roomId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `room_id=eq.${roomId}` },
        refresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'oven_batches', filter: `room_id=eq.${roomId}` },
        refresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        refresh
      )
      .subscribe()

    return () => {
      active = false
      clearInterval(polling)
      supabase.removeChannel(ch)
    }
  }, [roomId, loadData])

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const ovenDuration = room?.oven_duration_sec || 80
    const timers: Record<string, number> = {}

    ;[...batchesA, ...batchesB]
      .filter(batch => batch.status === 'procesando' && batch.started_at)
      .forEach(batch => {
        const elapsed = (Date.now() - new Date(batch.started_at!).getTime()) / 1000
        timers[batch.id] = Math.max(0, ovenDuration - elapsed)
      })

    setOvenTimers(timers)
  }, [tick, batchesA, batchesB, room])

  const batchSizeA = room?.oven_a_batch || 8
  const batchSizeB = room?.oven_b_batch || 4
  const mA = calcMetrics(ordersA, batchesA, batchSizeA)
  const mB = calcMetrics(ordersB, batchesB, batchSizeB)
  const ovenDur = room?.oven_duration_sec || 80

  const lines = [
    {
      label: 'Línea A',
      color: '#2563eb',
      soft: '#eff6ff',
      orders: ordersA,
      batches: batchesA,
      m: mA,
      batchSize: batchSizeA,
    },
    {
      label: 'Línea B',
      color: '#16a34a',
      soft: '#f0fdf4',
      orders: ordersB,
      batches: batchesB,
      m: mB,
      batchSize: batchSizeB,
    },
  ]

  return (
    <main style={{ padding: 18, background: '#f8fafc', minHeight: '100vh', color: '#111827' }}>
      <section
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 22,
          padding: 18,
          marginBottom: 16,
          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>🏭 Vista Empresa — En vivo</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              Métricas principales según lo que marca el cliente: a tiempo, tarde y no recibido.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>
              Sala{' '}
              <input
                value={roomId}
                onChange={e => setRoomId(e.target.value.toUpperCase())}
                style={{
                  marginLeft: 6,
                  background: '#ffffff',
                  color: '#111827',
                  border: '1px solid #cbd5e1',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontSize: 15,
                  width: 135,
                }}
              />
            </label>
            <a
              href="/docente"
              style={{
                fontSize: 13,
                padding: '9px 12px',
                borderRadius: 10,
                background: '#f1f5f9',
                color: '#334155',
                border: '1px solid #e2e8f0',
                textDecoration: 'none',
                fontWeight: 800,
              }}
            >
              Docente →
            </a>
            <span
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: '#b91c1c',
                background: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: 999,
                padding: '8px 12px',
              }}
            >
              ● Live
            </span>
          </div>
        </div>
      </section>

      {(mA.bottleneck !== '-' || mB.bottleneck !== '-') && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #f59e0b',
            color: '#7c2d12',
            borderRadius: 14,
            padding: '11px 14px',
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          ⚠{' '}
          {mA.bottleneck !== '-' && (
            <span>
              <strong>Línea A</strong>: cuello en <strong>{mA.bottleneck}</strong>
            </span>
          )}
          {mA.bottleneck !== '-' && mB.bottleneck !== '-' && ' · '}
          {mB.bottleneck !== '-' && (
            <span>
              <strong>Línea B</strong>: cuello en <strong>{mB.bottleneck}</strong>
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        {lines.map(({ label, color, soft, orders, batches, m, batchSize }) => {
          const active = batches.find(b => b.status === 'procesando')
          const ready = batches.find(b => b.status === 'listo')
          const remaining = active ? ovenTimers[active.id] ?? null : null

          const stations = [
            { n: 'E1', c: orders.filter(o => ['en_planificacion', 'ensamble1'].includes(o.status)).length },
            { n: 'E2', c: orders.filter(o => ['ensamble1_listo', 'ensamble2'].includes(o.status)).length },
            {
              n: 'Horno',
              c: orders.filter(o => ['ensamble2_listo', 'esperando_horno', 'en_horno'].includes(o.status)).length,
            },
            { n: 'Almacén', c: orders.filter(o => o.status === 'en_almacen').length },
          ]

          const recent = [...orders]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 12)

          return (
            <section
              key={label}
              style={{
                background: '#ffffff',
                borderRadius: 22,
                padding: 18,
                border: '1px solid #e5e7eb',
                boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: 14,
                }}
              >
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color }}>{label}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                    Resultado del cliente + flujo de producción
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 30, fontWeight: 950, color: '#111827' }}>{m.cumplimiento}%</div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800 }}>Cumplimiento</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
                <MetricBox value={m.ok} label="A tiempo" color="#16a34a" bg="#f0fdf4" />
                <MetricBox value={m.tarde} label="Tarde" color="#d97706" bg="#fffbeb" />
                <MetricBox value={m.noEntregado} label="No recibidos" color="#dc2626" bg="#fef2f2" />
                <MetricBox value={m.total} label="Pedidos" color="#111827" bg="#f8fafc" />
                <MetricBox value={m.first8} label="Primeras 8" color="#111827" bg="#f8fafc" />
                <MetricBox value={m.firstBatch} label="Primer lote" color="#111827" bg="#f8fafc" />
                <MetricBox value={m.avgLot} label={`Prom. lote ${batchSize}`} color="#111827" bg="#f8fafc" />
                <MetricBox value={m.productionLots.length} label="Lotes salidos" color="#111827" bg="#f8fafc" />
                <MetricBox value={m.enAlmacen} label="Stock" color="#111827" bg="#f8fafc" />
              </div>

              <div style={{ margin: '14px 0 10px', fontSize: 13, fontWeight: 900, color: '#334155' }}>
                Flujo físico de la línea
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                {stations.map((station, index) => (
                  <div key={station.n} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div
                        style={{
                          height: 48,
                          borderRadius: 12,
                          border: `2px solid ${station.c > 2 ? '#dc2626' : station.c > 0 ? color : '#e2e8f0'}`,
                          background: station.c > 2 ? '#fef2f2' : station.c > 0 ? soft : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 21,
                          fontWeight: 950,
                          color: station.c > 2 ? '#dc2626' : station.c > 0 ? color : '#111827',
                        }}
                      >
                        {station.c}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, fontWeight: 700 }}>{station.n}</div>
                    </div>
                    {index < stations.length - 1 && <div style={{ color: '#94a3b8', fontSize: 18 }}>›</div>}
                  </div>
                ))}
              </div>

              <div
                style={{
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 12,
                  border: `2px solid ${ready ? '#16a34a' : active ? '#f59e0b' : '#e2e8f0'}`,
                  background: ready ? '#f0fdf4' : active ? '#fffbeb' : '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, color: '#334155', fontWeight: 900 }}>🔥 Horno</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Lote: {batchSize} · {ovenDur}s · salida manual al almacén
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                    {Array.from({ length: batchSize }).map((_, i) => {
                      const filled = orders.filter(o =>
                        ['en_horno', 'esperando_horno', 'ensamble2_listo'].includes(o.status)
                      ).length

                      return (
                        <div
                          key={i}
                          style={{
                            width: 13,
                            height: 13,
                            borderRadius: 3,
                            background: ready ? '#16a34a' : i < filled ? color : '#e2e8f0',
                          }}
                        />
                      )
                    })}
                  </div>
                </div>

                {remaining !== null ? (
                  <div style={{ fontSize: 28, fontWeight: 950, color: '#d97706', fontVariantNumeric: 'tabular-nums' }}>
                    {String(Math.floor(remaining / 60)).padStart(2, '0')}:
                    {String(Math.round(remaining) % 60).padStart(2, '0')}
                  </div>
                ) : ready ? (
                  <div style={{ fontSize: 18, fontWeight: 950, color: '#16a34a' }}>Listo</div>
                ) : (
                  <div style={{ fontSize: 14, color: '#64748b', fontWeight: 800 }}>Vacío</div>
                )}
              </div>

              {m.productionLots.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#334155', marginBottom: 8 }}>
                    Salida de lotes
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {m.productionLots.slice(-4).map(lot => (
                      <div
                        key={lot.lotNumber}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 10,
                          padding: '8px 10px',
                          fontSize: 12,
                        }}
                      >
                        <strong>Lote {lot.lotNumber}</strong>
                        <span>{lot.quantity} productos</span>
                        <span style={{ fontWeight: 900 }}>{lot.durationLabel}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {recent.map(order => (
                  <div
                    key={order.id}
                    title={`#${order.sequence_number} ${order.product}`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: PRODUCT_COLOR[order.product] + '33',
                      border: `2px solid ${PRODUCT_COLOR[order.product]}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      fontWeight: 900,
                      color: '#111827',
                      opacity: ['entregado_ok', 'entregado_tarde', 'no_entregado', 'stock_consumido'].includes(order.status)
                        ? 0.45
                        : 1,
                    }}
                  >
                    {order.product[0]}
                  </div>
                ))}
                {orders.length === 0 && <span style={{ fontSize: 12, color: '#64748b' }}>Sin pedidos aún</span>}
              </div>
            </section>
          )
        })}
      </div>

      {(ordersA.length > 0 || ordersB.length > 0) && (
        <section
          style={{
            marginTop: 16,
            background: '#ffffff',
            borderRadius: 20,
            padding: 16,
            border: '1px solid #e5e7eb',
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
          }}
        >
          <div style={{ textAlign: 'center', fontSize: 13, color: '#64748b', fontWeight: 900, marginBottom: 12 }}>
            COMPARACIÓN GENERAL
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {[
              { label: 'Cumplimiento', a: mA.cumplimiento + '%', b: mB.cumplimiento + '%' },
              { label: 'No recibidos', a: mA.noEntregado, b: mB.noEntregado },
              { label: 'Primeras 8', a: mA.first8, b: mB.first8 },
              { label: 'Primer lote', a: mA.firstBatch, b: mB.firstBatch },
              { label: 'Promedio lote', a: mA.avgLot, b: mB.avgLot },
            ].map(item => (
              <div
                key={item.label}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 14,
                  padding: 12,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 900 }}>{item.label}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#2563eb', fontWeight: 950, fontSize: 14 }}>{item.a}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>vs</span>
                  <span style={{ color: '#16a34a', fontWeight: 950, fontSize: 14 }}>{item.b}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

function MetricBox({
  value,
  label,
  color,
  bg,
}: {
  value: string | number
  label: string
  color: string
  bg: string
}) {
  return (
    <div
      style={{
        background: bg,
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: '12px 10px',
        textAlign: 'center',
        minHeight: 76,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 950, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 800, marginTop: 4 }}>{label}</div>
    </div>
  )
}
