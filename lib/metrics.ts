import type { Order, OvenBatch } from './types'

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

// Tiempo desde el primer pedido hasta la octava entrega
export function timeToFirst8(orders: Order[]): string {
  const delivered = orders
    .filter(o => o.status === 'entregado_ok' || o.status === 'entregado_tarde')
    .sort((a, b) => new Date(a.delivered_at!).getTime() - new Date(b.delivered_at!).getTime())
  if (delivered.length < 8) return '-'
  const firstRequest = orders.reduce((min, o) => {
    const t = new Date(o.requested_at).getTime()
    return t < min ? t : min
  }, Infinity)
  const eighthDelivery = new Date(delivered[7].delivered_at!).getTime()
  return formatDuration(eighthDelivery - firstRequest)
}

// Tiempo desde que el primer lote entró al horno hasta que salió
export function timeFirstBatch(batches: OvenBatch[]): string {
  const first = batches
    .filter(b => b.started_at && b.released_at)
    .sort((a, b) => new Date(a.started_at!).getTime() - new Date(b.started_at!).getTime())[0]
  if (!first) return '-'
  return formatDuration(
    new Date(first.released_at!).getTime() - new Date(first.started_at!).getTime()
  )
}

export function calcMetrics(orders: Order[], batches: OvenBatch[] = []) {
  const total        = orders.length
  const ok           = orders.filter(o => o.status === 'entregado_ok').length
  const tarde        = orders.filter(o => o.status === 'entregado_tarde').length
  const noEntregado  = orders.filter(o => o.status === 'no_entregado').length
  const enLinea      = orders.filter(o =>
    !['entregado_ok','entregado_tarde','no_entregado','pendiente'].includes(o.status)
  ).length
  const enHorno      = orders.filter(o => o.status === 'en_horno').length
  const enAlmacen    = orders.filter(o => o.status === 'en_almacen').length

  const cycleTimes   = orders.map(cycleTimeMs).filter((v): v is number => v !== null)
  const avgCycle     = cycleTimes.length
    ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
    : 0

  // NPS automático: 0=perdido, 1=tarde, 2=a tiempo
  const npsValues: number[] = orders
    .filter(o => o.client_verdict)
    .map(o => o.client_verdict === 'ok' ? 2 : o.client_verdict === 'tarde' ? 1 : 0)
  const npsAvg = npsValues.length
    ? (npsValues.reduce((a, b) => a + b, 0) / npsValues.length).toFixed(1)
    : '-'

  const stationQueues = {
    'Ensamble 1': orders.filter(o => ['en_planificacion','ensamble1'].includes(o.status)).length,
    'Ensamble 2': orders.filter(o => ['ensamble1_listo','ensamble2'].includes(o.status)).length,
    'Horno':      orders.filter(o => ['ensamble2_listo','esperando_horno','en_horno'].includes(o.status)).length,
    'Almacén':    orders.filter(o => o.status === 'en_almacen').length,
  }
  const bottleneckEntry = Object.entries(stationQueues).sort((a, b) => b[1] - a[1])[0]

  return {
    total, ok, tarde, noEntregado, enLinea, enHorno, enAlmacen,
    cumplimiento:   total ? Math.round((ok / total) * 100) : 0,
    avgCycleLabel:  formatDuration(avgCycle),
    bottleneck:     bottleneckEntry && bottleneckEntry[1] > 0 ? bottleneckEntry[0] : '-',
    stationQueues,
    first8:         timeToFirst8(orders),
    firstBatch:     timeFirstBatch(batches),
    npsAvg,
  }
}

// Estado actual de un jugador según su rol y los pedidos de su línea
export function playerStatus(role: string, orders: Order[], batches: OvenBatch[]): string {
  switch (role) {
    case 'Técnico de Fabricación Alpha': {
      const active = orders.find(o => o.status === 'ensamble1')
      if (active) return `Armando ${active.product} #${active.sequence_number}`
      const waiting = orders.filter(o => o.status === 'en_planificacion').length
      return waiting > 0 ? `${waiting} en cola` : 'Esperando...'
    }
    case 'Técnico de Fabricación Beta': {
      const active = orders.find(o => o.status === 'ensamble2')
      if (active) return `Completando ${active.product} #${active.sequence_number}`
      const waiting = orders.filter(o => o.status === 'ensamble1_listo').length
      return waiting > 0 ? `${waiting} en cola` : 'Esperando...'
    }
    case 'Ingeniero de Procesos Térmicos': {
      const processing = batches.find(b => b.status === 'procesando')
      if (processing && processing.started_at) {
        const elapsed = (Date.now() - new Date(processing.started_at).getTime()) / 1000
        const remaining = Math.max(0, 80 - elapsed)
        return `⏱ ${String(Math.floor(remaining / 60)).padStart(2,'0')}:${String(Math.round(remaining) % 60).padStart(2,'0')} restantes`
      }
      const ready = batches.find(b => b.status === 'listo')
      if (ready) return '¡Lote listo para liberar!'
      const waiting = orders.filter(o => ['ensamble2_listo','esperando_horno'].includes(o.status)).length
      return waiting > 0 ? `${waiting} esperando entrar` : 'Horno vacío'
    }
    case 'Gerente de Logística y Distribución': {
      const stock = orders.filter(o => o.status === 'en_almacen').length
      const delivered = orders.filter(o => ['entregado_ok','entregado_tarde'].includes(o.status)).length
      return `${stock} en stock · ${delivered} entregados`
    }
    case 'Jefe de Planificación Estratégica': {
      const enLinea = orders.filter(o =>
        !['pendiente','entregado_ok','entregado_tarde','no_entregado'].includes(o.status)
      ).length
      return `${enLinea} productos en línea`
    }
    case 'Coordinador de Materiales': {
      const recycled = orders.filter(o =>
        ['entregado_ok','entregado_tarde','no_entregado'].includes(o.status)
      ).length
      return `${recycled} para reciclar`
    }
    case 'Cliente':
      return 'Vista privada'
    default:
      return 'Conectado'
  }
}
