import type { Order, OvenBatch } from './types'

export const CLIENT_ORDER_STATUSES = ['pendiente', 'entregado_ok', 'entregado_tarde', 'no_entregado'] as const
export const PRODUCTION_ACTIVE_STATUSES = [
  'en_planificacion',
  'ensamble1',
  'ensamble1_listo',
  'ensamble2',
  'ensamble2_listo',
  'esperando_horno',
  'en_horno',
] as const

export function isClientDemandOrder(order: Pick<Order, 'status' | 'client_verdict'>): boolean {
  return !!order.client_verdict || CLIENT_ORDER_STATUSES.includes(order.status as any)
}

export function isProductionOrder(order: Pick<Order, 'status' | 'client_verdict'>): boolean {
  return !isClientDemandOrder(order)
}

export function productionOrders(orders: Order[]): Order[] {
  return orders.filter(isProductionOrder)
}

export function clientDemandOrders(orders: Order[]): Order[] {
  return orders.filter(isClientDemandOrder)
}

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

// Tiempo hasta la salida de los primeros 8 productos terminados al almacén.
// Línea A necesita 1 lote de 8; Línea B normalmente necesita 2 lotes de 4 para llegar a 8.
export function timeToFirst8(orders: Order[]): string {
  const prodOrders = productionOrders(orders)
  const outputs = prodOrders
    .filter(o => o.almacen_entry || o.horno_exit)
    .sort((a, b) =>
      new Date(a.almacen_entry || a.horno_exit!).getTime() -
      new Date(b.almacen_entry || b.horno_exit!).getTime()
    )

  if (outputs.length < 8) return '-'

  const firstStart = prodOrders.reduce((min, o) => {
    const raw = o.planificacion_start || o.ensamble1_start || o.requested_at || o.created_at
    const t = new Date(raw).getTime()
    return t < min ? t : min
  }, Infinity)

  if (!Number.isFinite(firstStart)) return '-'

  const eighthOutput = new Date(outputs[7].almacen_entry || outputs[7].horno_exit!).getTime()
  return formatDuration(eighthOutput - firstStart)
}

// Tiempo desde que el primer lote entró al horno hasta que salió manualmente al almacén.
export function timeFirstBatch(batches: OvenBatch[]): string {
  const first = batches
    .filter(b => b.started_at && b.released_at)
    .sort((a, b) => new Date(a.started_at!).getTime() - new Date(b.started_at!).getTime())[0]

  if (!first) return '-'

  return formatDuration(
    new Date(first.released_at!).getTime() - new Date(first.started_at!).getTime()
  )
}

function productionStartMs(order: Order): number {
  const raw = order.planificacion_start || order.ensamble1_start || order.requested_at || order.created_at
  return new Date(raw).getTime()
}

function outputMs(order: Order): number | null {
  const raw = order.almacen_entry || order.horno_exit
  return raw ? new Date(raw).getTime() : null
}

export type ProductionLotSummary = {
  lotNumber: number
  quantity: number
  startedAt: string
  finishedAt: string
  durationMs: number
  durationLabel: string
}

// Lotes de salida a almacén.
// Línea A normalmente agrupa de 8; Línea B normalmente agrupa de 4.
// No usa solo el tiempo fijo del horno: mide desde que el lote empezó a producirse hasta que llegó a almacén.
export function productionLotSummaries(orders: Order[], batchSize = 8): ProductionLotSummary[] {
  const outputs = productionOrders(orders)
    .filter(o => outputMs(o) !== null)
    .sort((a, b) => outputMs(a)! - outputMs(b)!)

  const lots: ProductionLotSummary[] = []

  for (let i = 0; i + batchSize <= outputs.length; i += batchSize) {
    const chunk = outputs.slice(i, i + batchSize)
    const start = Math.min(...chunk.map(productionStartMs))
    const finish = Math.max(...chunk.map(o => outputMs(o)!))

    lots.push({
      lotNumber: lots.length + 1,
      quantity: batchSize,
      startedAt: new Date(start).toISOString(),
      finishedAt: new Date(finish).toISOString(),
      durationMs: finish - start,
      durationLabel: formatDuration(finish - start),
    })
  }

  return lots
}

export function averageProductionLotTime(orders: Order[], batchSize = 8): string {
  const lots = productionLotSummaries(orders, batchSize)
  if (!lots.length) return '-'
  const avg = lots.reduce((acc, lot) => acc + lot.durationMs, 0) / lots.length
  return formatDuration(avg)
}

export function calcMetrics(orders: Order[], batches: OvenBatch[] = [], batchSize = 8) {
  const clientOrders = clientDemandOrders(orders)
  const prodOrders = productionOrders(orders)
  const total = clientOrders.length

  const ok = clientOrders.filter(o => o.client_verdict === 'ok').length
  const tarde = clientOrders.filter(o => o.client_verdict === 'tarde').length
  const noEntregado = clientOrders.filter(o => o.client_verdict === 'no_entregado').length

  const enLinea = prodOrders.filter(o => PRODUCTION_ACTIVE_STATUSES.includes(o.status as any)).length
  const enHorno = prodOrders.filter(o => o.status === 'en_horno').length
  const enAlmacen = prodOrders.filter(o => o.status === 'en_almacen').length

  const cycleTimes = clientOrders
    .filter(o => o.client_verdict)
    .map(cycleTimeMs)
    .filter((v): v is number => v !== null)

  const avgCycle = cycleTimes.length
    ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
    : 0

  // Satisfacción automática: 0=perdido, 1=tarde, 2=a tiempo
  const npsValues: number[] = clientOrders
    .filter(o => o.client_verdict)
    .map(o => o.client_verdict === 'ok' ? 2 : o.client_verdict === 'tarde' ? 1 : 0)

  const npsAvg = npsValues.length
    ? (npsValues.reduce((a, b) => a + b, 0) / npsValues.length).toFixed(1)
    : '-'

  const stationQueues = {
    'Ensamble 1': prodOrders.filter(o => ['en_planificacion', 'ensamble1'].includes(o.status)).length,
    'Ensamble 2': prodOrders.filter(o => ['ensamble1_listo', 'ensamble2'].includes(o.status)).length,
    'Horno': prodOrders.filter(o => ['ensamble2_listo', 'esperando_horno', 'en_horno'].includes(o.status)).length,
    'Almacén': prodOrders.filter(o => o.status === 'en_almacen').length,
  }

  const bottleneckEntry = Object.entries(stationQueues).sort((a, b) => b[1] - a[1])[0]

  return {
    total,
    ok,
    tarde,
    noEntregado,
    enLinea,
    enHorno,
    enAlmacen,
    cumplimiento: total ? Math.round((ok / total) * 100) : 0,
    avgCycleLabel: formatDuration(avgCycle),
    bottleneck: bottleneckEntry && bottleneckEntry[1] > 0 ? bottleneckEntry[0] : '-',
    stationQueues,
    first8: timeToFirst8(orders),
    firstBatch: timeFirstBatch(batches),
    avgLot: averageProductionLotTime(orders, batchSize),
    productionLots: productionLotSummaries(orders, batchSize),
    npsAvg,
  }
}

// Estado actual de un jugador según su rol y los pedidos de su línea.
export function playerStatus(role: string, orders: Order[], batches: OvenBatch[]): string {
  const prodOrders = productionOrders(orders)

  switch (role) {
    case 'Técnico de Fabricación Alpha': {
      const active = prodOrders.find(o => o.status === 'ensamble1')
      if (active) return `Armando ${active.product} #${active.sequence_number}`
      const waiting = prodOrders.filter(o => o.status === 'en_planificacion').length
      return waiting > 0 ? `${waiting} en cola` : 'Esperando...'
    }

    case 'Técnico de Fabricación Beta': {
      const active = prodOrders.find(o => o.status === 'ensamble2')
      if (active) return `Completando ${active.product} #${active.sequence_number}`
      const waiting = prodOrders.filter(o => o.status === 'ensamble1_listo').length
      return waiting > 0 ? `${waiting} en cola` : 'Esperando...'
    }

    case 'Ingeniero de Procesos Térmicos': {
      const processing = batches.find(b => b.status === 'procesando')
      if (processing && processing.started_at) {
        const elapsed = (Date.now() - new Date(processing.started_at).getTime()) / 1000
        const remaining = Math.max(0, 80 - elapsed)
        return `⏱ ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(Math.round(remaining) % 60).padStart(2, '0')} restantes`
      }

      const ready = batches.find(b => b.status === 'listo')
      if (ready) return '¡Lote listo para liberar!'

      const waiting = prodOrders.filter(o => ['ensamble2_listo', 'esperando_horno'].includes(o.status)).length
      return waiting > 0 ? `${waiting} esperando entrar` : 'Horno vacío'
    }

    case 'Encargado de Almacén':
    case 'Gerente de Logística y Distribución': {
      const stock = prodOrders.filter(o => o.status === 'en_almacen').length
      const delivered = clientDemandOrders(orders).filter(o => ['ok', 'tarde'].includes(String(o.client_verdict))).length
      return `${stock} en stock · ${delivered} entregados`
    }

    case 'Jefe de Planificación Estratégica': {
      const enLinea = prodOrders.filter(o => PRODUCTION_ACTIVE_STATUSES.includes(o.status as any)).length
      return `${enLinea} productos en línea`
    }

    case 'Coordinador de Materiales': {
      const recycled = clientDemandOrders(orders).filter(o =>
        ['entregado_ok', 'entregado_tarde', 'no_entregado'].includes(o.status)
      ).length
      return `${recycled} para reciclar`
    }

    case 'Cliente':
      return 'Vista privada'

    default:
      return 'Conectado'
  }
}
