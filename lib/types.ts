export type Line = 'A' | 'B'
export type RoomStatus = 'waiting' | 'prep' | 'running' | 'paused' | 'finished'
export type Product = 'Bicolor' | 'Amarillo' | 'Rojo'
export type OrderStatus =
  | 'pendiente' | 'en_planificacion' | 'ensamble1' | 'ensamble1_listo'
  | 'ensamble2' | 'ensamble2_listo' | 'esperando_horno' | 'en_horno'
  | 'en_almacen' | 'entregado_ok' | 'entregado_tarde' | 'no_entregado'
export type ClientVerdict = 'ok' | 'tarde' | 'no_entregado'
export type OvenStatus = 'cargando' | 'procesando' | 'listo' | 'liberado'
export type Role =
  | 'Cliente'
  | 'Jefe de Planificación Estratégica'
  | 'Técnico de Fabricación Alpha'
  | 'Técnico de Fabricación Beta'
  | 'Ingeniero de Procesos Térmicos'
  | 'Encargado de Almacén'
  | 'Gerente de Logística y Distribución' // legado: por si quedó guardado en algún celular
  | 'Coordinador de Materiales'
  | 'Docente'

export type Room = {
  id: string
  status: RoomStatus
  demand_interval_sec: number
  demand_sequence: Product[]
  oven_a_batch: number
  oven_b_batch: number
  oven_duration_sec: number
  prep_time_sec: number
  started_at: string | null
  paused_at: string | null
  finished_at: string | null
  created_at: string
}

export type Player = {
  id: string
  room_id: string
  name: string
  line: Line
  role: Role
  connected_at: string
}

export type Order = {
  id: string
  room_id: string
  line: Line
  sequence_number: number
  product: Product
  status: OrderStatus
  requested_at: string
  planificacion_start: string | null
  ensamble1_start: string | null
  ensamble1_end: string | null
  ensamble2_start: string | null
  ensamble2_end: string | null
  horno_entry: string | null
  horno_exit: string | null
  almacen_entry: string | null
  delivered_at: string | null
  client_verdict: ClientVerdict | null
  notes: string | null
  created_at: string
}

export type OvenBatch = {
  id: string
  room_id: string
  line: Line
  batch_number: number
  status: OvenStatus
  started_at: string | null
  ready_at: string | null
  released_at: string | null
  created_at: string
}

export type NpsResponse = {
  id: string
  room_id: string
  line: Line
  score: number
  submitted_at: string
}

export type PlayerSession = {
  roomId: string
  playerId: string
  name: string
  line: Line
  role: Role
}

export const PRODUCTS: Product[] = ['Bicolor', 'Amarillo', 'Rojo']

export const PRODUCT_COLOR: Record<Product, string> = {
  Bicolor:  '#3b82f6',
  Amarillo: '#eab308',
  Rojo:     '#ef4444',
}

export const PRODUCT_LABEL: Record<Product, string> = {
  Bicolor:  'Bicolor',
  Amarillo: 'Amarillo',
  Rojo:     'Rojo',
}

export const COMPANY_ROLES: Role[] = [
  'Jefe de Planificación Estratégica',
  'Técnico de Fabricación Alpha',
  'Técnico de Fabricación Beta',
  'Ingeniero de Procesos Térmicos',
  'Encargado de Almacén',
  'Coordinador de Materiales',
]

// Secuencia T1 — Línea A
export const DEMAND_SEQUENCE_T1: Product[] = [
  'Bicolor','Amarillo','Bicolor','Amarillo','Bicolor','Amarillo','Bicolor','Bicolor',
  'Bicolor','Rojo',    'Bicolor','Bicolor', 'Amarillo','Rojo',   'Amarillo','Bicolor',
  'Bicolor','Amarillo','Bicolor','Rojo',    'Rojo',   'Rojo',   'Rojo',    'Bicolor',
  'Bicolor','Bicolor', 'Bicolor','Bicolor', 'Bicolor','Amarillo','Rojo',   'Rojo',
  'Amarillo','Rojo',   'Amarillo','Bicolor','Amarillo','Bicolor','Bicolor','Rojo',
]

// Secuencia T2 — Línea B
export const DEMAND_SEQUENCE_T2: Product[] = [
  'Bicolor','Bicolor', 'Bicolor','Rojo',    'Amarillo','Amarillo','Bicolor','Bicolor',
  'Bicolor','Rojo',    'Bicolor','Bicolor', 'Bicolor', 'Bicolor', 'Bicolor','Bicolor',
  'Rojo',   'Rojo',    'Bicolor','Amarillo','Rojo',    'Bicolor', 'Bicolor','Amarillo',
  'Bicolor','Amarillo','Rojo',   'Bicolor', 'Amarillo','Bicolor', 'Rojo',   'Amarillo',
  'Bicolor','Amarillo','Amarillo','Rojo',   'Rojo',    'Bicolor', 'Rojo',   'Amarillo',
]

// Plan 8:4:4 — Línea A (se repite)
export const PLAN_844: Product[] = [
  ...Array(8).fill('Bicolor')  as Product[],
  ...Array(4).fill('Amarillo') as Product[],
  ...Array(4).fill('Rojo')     as Product[],
]

// Plan 4:2:2 — Línea B (se repite)
export const PLAN_422: Product[] = [
  ...Array(4).fill('Bicolor')  as Product[],
  ...Array(2).fill('Amarillo') as Product[],
  ...Array(2).fill('Rojo')     as Product[],
]

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pendiente:        'Pendiente',
  en_planificacion: 'En planificación',
  ensamble1:        'En Ensamble 1',
  ensamble1_listo:  'Listo para Ensamble 2',
  ensamble2:        'En Ensamble 2',
  ensamble2_listo:  'Listo para Horno',
  esperando_horno:  'Esperando Horno',
  en_horno:         'En Horno 🔥',
  en_almacen:       'En Almacén',
  entregado_ok:     'Entregado ✓',
  entregado_tarde:  'Entregado tarde ⚠',
  no_entregado:     'No entregado ✗',
}
