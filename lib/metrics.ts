import type { Order } from './types'

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '-'
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function cycleTimeMs(order: Order): number | null {
  if (!order.delivered_at) return null
  return new Date(order.delivered_at).getTime() - new Date(order.requested_at).getTime()
}

export function timeToFirst8(orders: Order[]): string {
  const delivered = orders
    .filter(o => o.status === 'entregado_ok' || o.status === 'entregado_tarde')
    .sort((a, b) => new Date(a.delivered_at!).getTime() - new Date(b.delivered_at!).getTime())
  if (delivered.length < 8) return '-'
  const first = orders.reduce((min, o) => {
    const t = new Date(o.requested_at).getTime()
    return t < min ? t : min
  }, Infinity)
  const eighth = new Date(delivered[7].delivered_at!).getTime()
  return formatDuration(eighth - first)
}

export function calcMetrics(orders: Order[]) {
  const total = orders.length
  const ok = orders.filter(o => o.status === 'entregado_ok').length
  const tarde = orders.filter(o => o.status === 'entregado_tarde').length
  const noEntregado = orders.filter(o => o.status === 'no_entregado').length
  const enLinea = orders.filter(o => !['entregado_ok','entregado_tarde','no_entregado','pendiente'].includes(o.status)).length
  const enHorno = orders.filter(o => o.status === 'en_horno').length
  const enAlmacen = orders.filter(o => o.status === 'en_almacen').length

  const cycleTimes = orders.map(cycleTimeMs).filter((v): v is number => v !== null)
  const avgCycle = cycleTimes.length ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length : 0

  const stationQueues = {
    'Ensamble 1': orders.filter(o => ['en_planificacion','ensamble1'].includes(o.status)).length,
    'Ensamble 2': orders.filter(o => ['ensamble1_listo','ensamble2'].includes(o.status)).length,
    'Horno': orders.filter(o => ['ensamble2_listo','esperando_horno','en_horno'].includes(o.status)).length,
    'Almacén': orders.filter(o => o.status === 'en_almacen').length,
  }
  const bottleneck = Object.entries(stationQueues).sort((a, b) => b[1] - a[1])[0]

  return {
    total, ok, tarde, noEntregado, enLinea, enHorno, enAlmacen,
    cumplimiento: total ? Math.round((ok / total) * 100) : 0,
    avgCycleLabel: formatDuration(avgCycle),
    bottleneck: bottleneck && bottleneck[1] > 0 ? bottleneck[0] : '-',
    stationQueues,
    first8: timeToFirst8(orders),
  }
}
