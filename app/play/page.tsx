'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { getSession, clearSession } from '../../lib/session'
import {
  ORDER_STATUS_LABEL, PLAN_422, PLAN_844, PRODUCT_COLOR, PRODUCT_LABEL,
  type Order, type OvenBatch, type PlayerSession, type Product, type Room,
} from '../../lib/types'
import { calcMetrics } from '../../lib/metrics'

function ProductPill({ p }: { p: string }) {
  const map: Record<string, string> = { Bicolor: 'pill-bc', Amarillo: 'pill-am', Rojo: 'pill-r' }
  const label: Record<string, string> = { Bicolor: 'Bicolor', Amarillo: 'Amarillo', Rojo: 'Rojo' }
  return <span className={map[p] || ''}>{label[p] || p}</span>
}

const LEGO = {
  red: '#ef4444',
  green: '#84cc16',
  yellow: '#fde047',
  blue: '#0ea5e9',
  white: '#ffffff',
  border: '#111827',
}

function LegoBlock({
  color,
  x,
  y,
  w,
  h,
  label,
}: {
  color: string
  x: number
  y: number
  w: number
  h: number
  label?: string
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        background: color,
        border: `2px solid ${LEGO.border}`,
        borderRadius: 3,
        boxShadow: '0 2px 0 rgba(15,23,42,.18)',
      }}
    >
      {label && (
        <span
          style={{
            position: 'absolute',
            left: 4,
            top: 3,
            fontSize: 10,
            fontWeight: 900,
            color: '#111827',
            background: 'rgba(255,255,255,.75)',
            padding: '1px 4px',
            borderRadius: 999,
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
}

function GuideTag({ children, tone }: { children: string; tone: 'add' | 'base' }) {
  return (
    <div
      style={{
        display: 'inline-block',
        margin: '8px auto 8px',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: '.02em',
        color: tone === 'add' ? '#92400e' : '#1d4ed8',
        background: tone === 'add' ? '#fef3c7' : '#dbeafe',
        border: tone === 'add' ? '2px solid #f59e0b' : '2px solid #60a5fa',
      }}
    >
      {children}
    </div>
  )
}

function ProductDiagram({ product, stage }: { product: Product; stage: 'alpha' | 'beta' }) {
  const isAlpha = stage === 'alpha'

  const canvasStyle = {
    position: 'relative' as const,
    width: 290,
    height: 500,
    margin: '0 auto',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 18,
    overflow: 'hidden',
  }

  const receivedBox = (top: number, height: number, label = 'YA VIENE DE ALPHA') => (
    <>
      <div style={{ position: 'absolute', left: 40, top, width: 210, height, border: '3px dashed #60a5fa', borderRadius: 12 }} />
      <div style={{ position: 'absolute', left: 55, top: top - 16, width: 180, textAlign: 'center' }}>
        <GuideTag tone="base">{label}</GuideTag>
      </div>
    </>
  )

  return (
    <div style={canvasStyle}>
      {/* BICOLOR — ALPHA: arma toda la estructura base que Beta recibirá armada */}
      {product === 'Bicolor' && isAlpha && (
        <>
          <div style={{ position: 'absolute', left: 82, top: 10, width: 126, textAlign: 'center' }}>
            <GuideTag tone="add">ARMAR EN ALPHA</GuideTag>
          </div>

          <div style={{ position: 'absolute', left: 42, right: 42, top: 56, fontSize: 12, fontWeight: 800, color: '#475569', textAlign: 'center' }}>
            Arma esta base completa y pásala a Ensamble 2.
          </div>

          {/* Estructura base Bicolor: esto luego aparece como "ya viene de Alpha" en Beta */}
          <LegoBlock color={LEGO.green} x={75} y={120} w={140} h={56} label="verde 2x2" />
          <div style={{ position: 'absolute', left: 75, top: 176, width: 140, height: 110 }}>
            <LegoBlock color={LEGO.green} x={0} y={0} w={70} h={110} label="verde 2x1" />
            <LegoBlock color={LEGO.yellow} x={70} y={0} w={70} h={110} label="amarillo 2x1" />
          </div>
          <LegoBlock color={LEGO.red} x={75} y={286} w={140} h={56} label="rojo 2x2" />

        </>
      )}

      {/* BICOLOR — BETA: recibe la estructura armada; solo agrega arriba y abajo */}
      {product === 'Bicolor' && !isAlpha && (
        <>
          <div style={{ position: 'absolute', left: 82, top: 8, width: 126, textAlign: 'center' }}>
            <GuideTag tone="add">AGREGAR</GuideTag>
          </div>
          <LegoBlock color={LEGO.yellow} x={75} y={46} w={140} h={52} label="amarillo 2x1" />

          {receivedBox(130, 194)}
          {/* Estructura recibida desde Alpha. Sin etiquetas de tamaño para que Beta no la vuelva a armar. */}
          <LegoBlock color={LEGO.green} x={75} y={158} w={140} h={52} />
          <div style={{ position: 'absolute', left: 75, top: 210, width: 140, height: 86 }}>
            <LegoBlock color={LEGO.green} x={0} y={0} w={70} h={86} />
            <LegoBlock color={LEGO.yellow} x={70} y={0} w={70} h={86} />
          </div>
          <LegoBlock color={LEGO.red} x={75} y={296} w={140} h={52} />
          <div style={{ position: 'absolute', left: 54, top: 350, width: 182, fontSize: 12, fontWeight: 800, color: '#2563eb', textAlign: 'center' }}>
            Estructura recibida de Alpha
          </div>

          <div style={{ position: 'absolute', left: 82, top: 374, width: 126, textAlign: 'center' }}>
            <GuideTag tone="add">AGREGAR</GuideTag>
          </div>
          <LegoBlock color={LEGO.red} x={75} y={414} w={70} h={52} label="rojo 1x1" />
          <LegoBlock color={LEGO.white} x={145} y={414} w={70} h={52} label="blanco 1x1" />
        </>
      )}

      {/* AMARILLO — ALPHA: arma base amarilla + bloque azul */}
      {product === 'Amarillo' && isAlpha && (
        <>
          <div style={{ position: 'absolute', left: 82, top: 20, width: 126, textAlign: 'center' }}>
            <GuideTag tone="add">ARMAR EN ALPHA</GuideTag>
          </div>
          <div style={{ position: 'absolute', left: 42, right: 42, top: 64, fontSize: 12, fontWeight: 800, color: '#475569', textAlign: 'center' }}>
            Arma esta base completa y pásala a Ensamble 2.
          </div>
          <LegoBlock color={LEGO.yellow} x={52} y={260} w={186} h={72} label="base amarilla 4x2" />
          <LegoBlock color={LEGO.blue} x={99} y={140} w={92} h={92} label="azul 2x2" />
        </>
      )}

      {/* AMARILLO — BETA: solo agrega piezas finales; la base ya viene de Alpha */}
      {product === 'Amarillo' && !isAlpha && (
        <>
          <div style={{ position: 'absolute', left: 82, top: 10, width: 126, textAlign: 'center' }}>
            <GuideTag tone="add">AGREGAR</GuideTag>
          </div>
          <LegoBlock color={LEGO.red} x={42} y={70} w={54} h={112} label="rojo 2x1" />
          <LegoBlock color={LEGO.green} x={110} y={66} w={52} h={52} label="verde 1x1" />
          <LegoBlock color={LEGO.red} x={174} y={66} w={52} h={52} label="rojo 1x1" />

          {receivedBox(232, 130)}
          {/* Base recibida desde Alpha. Sin etiquetas de piezas para no confundir a Beta. */}
          <LegoBlock color={LEGO.yellow} x={52} y={300} w={186} h={62} />
          <LegoBlock color={LEGO.blue} x={99} y={246} w={92} h={72} />
          <div style={{ position: 'absolute', left: 54, top: 370, width: 182, fontSize: 12, fontWeight: 800, color: '#2563eb', textAlign: 'center' }}>
            Base recibida de Alpha
          </div>
        </>
      )}

      {/* ROJO — ALPHA: arma base roja + bloque amarillo */}
      {product === 'Rojo' && isAlpha && (
        <>
          <div style={{ position: 'absolute', left: 82, top: 20, width: 126, textAlign: 'center' }}>
            <GuideTag tone="add">ARMAR EN ALPHA</GuideTag>
          </div>
          <div style={{ position: 'absolute', left: 42, right: 42, top: 64, fontSize: 12, fontWeight: 800, color: '#475569', textAlign: 'center' }}>
            Arma esta base completa y pásala a Ensamble 2.
          </div>
          <LegoBlock color={LEGO.red} x={52} y={260} w={186} h={72} label="base roja 4x2" />
          <LegoBlock color={LEGO.yellow} x={99} y={140} w={92} h={92} label="amarillo 2x2" />
        </>
      )}

      {/* ROJO — BETA: solo agrega piezas finales; la base ya viene de Alpha */}
      {product === 'Rojo' && !isAlpha && (
        <>
          <div style={{ position: 'absolute', left: 82, top: 10, width: 126, textAlign: 'center' }}>
            <GuideTag tone="add">AGREGAR</GuideTag>
          </div>
          <LegoBlock color={LEGO.green} x={60} y={64} w={112} h={52} label="verde 2x1" />
          <LegoBlock color={LEGO.blue} x={102} y={138} w={52} h={52} label="azul 1x1" />
          <LegoBlock color={LEGO.green} x={166} y={138} w={52} h={52} label="verde 1x1" />

          {receivedBox(232, 130)}
          {/* Base recibida desde Alpha. Sin etiquetas de piezas para no confundir a Beta. */}
          <LegoBlock color={LEGO.red} x={52} y={300} w={186} h={62} />
          <LegoBlock color={LEGO.yellow} x={99} y={246} w={92} h={72} />
          <div style={{ position: 'absolute', left: 54, top: 370, width: 182, fontSize: 12, fontWeight: 800, color: '#2563eb', textAlign: 'center' }}>
            Base recibida de Alpha
          </div>
        </>
      )}
    </div>
  )
}


function ProductGuide({ product, stage }: { product: Product; stage: 'alpha' | 'beta' }) {
  const title = stage === 'alpha' ? 'Montaje 1' : 'Montaje 2'
  const subtitle = stage === 'alpha'
    ? 'Arma la base indicada y pásala físicamente a Ensamble 2.'
    : 'Recibe la base de Alpha y agrega solo las piezas marcadas.'

  return (
    <div className="card" style={{ textAlign: 'center', padding: 16 }}>
      <h3 style={{ marginBottom: 8 }}>{title} — Pieza {product}</h3>
      <p className="small" style={{ marginBottom: 12 }}>{subtitle}</p>
      <ProductDiagram product={product} stage={stage} />
    </div>
  )
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

    let active = true
    const s = session
    const refresh = () => {
      if (active) loadData(s)
    }

    refresh()

    // Realtime + respaldo: si Supabase tarda en avisar, igual refresca cada 1.5 s.
    const polling = setInterval(refresh, 1500)

    const ch = supabase.channel('play-' + s.roomId + '-' + s.line)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders',
        filter: `room_id=eq.${s.roomId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oven_batches',
        filter: `room_id=eq.${s.roomId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms',
        filter: `id=eq.${s.roomId}` }, refresh)
      .subscribe()

    return () => {
      active = false
      clearInterval(polling)
      supabase.removeChannel(ch)
    }
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
            <PlanificadorPanel orders={orders} batches={batches} session={session} onUpdate={update} />}
          {session.role === 'Técnico de Fabricación Alpha' &&
            <Ensamble1Panel orders={orders} onUpdate={update} />}
          {session.role === 'Técnico de Fabricación Beta' &&
            <Ensamble2Panel orders={orders} onUpdate={update} />}
          {session.role === 'Ingeniero de Procesos Térmicos' &&
            <HornoPanel orders={orders} batches={batches} session={session} room={room} setMsg={setMsg} />}
          {(session.role === 'Encargado de Almacén' || session.role === 'Gerente de Logística y Distribución') &&
            <AlmacenPanel orders={orders} onUpdate={update} />}
          {session.role === 'Coordinador de Materiales' &&
            <ReciclajePanel orders={orders} />}
        </>
      )}
    </main>
  )
}

// ─── PLANIFICADOR ────────────────────────────────────────────────────────────
function PlanificadorPanel({ orders, batches, session, onUpdate }: {
  orders: Order[], batches: OvenBatch[], session: PlayerSession,
  onUpdate: (id: string, d: Partial<Order>) => void,
}) {
  const plan      = session.line === 'A' ? PLAN_844 : PLAN_422
  const batchSize = session.line === 'A' ? 8 : 4
  const planName  = session.line === 'A' ? '8:4:4' : '4:2:2'
  const metrics   = calcMetrics(orders, batches, batchSize)
  const stockBicolor  = orders.filter(o => o.status === 'en_almacen' && o.product === 'Bicolor').length
  const stockAmarillo = orders.filter(o => o.status === 'en_almacen' && o.product === 'Amarillo').length
  const stockRojo     = orders.filter(o => o.status === 'en_almacen' && o.product === 'Rojo').length
  const latestLots = metrics.productionLots.slice(-3)

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
        <div className="metric good"><div className="val">{metrics.ok}</div><div className="lbl">A tiempo</div></div>
        <div className="metric"><div className="val">{metrics.tarde}</div><div className="lbl">Tarde</div></div>
        <div className="metric bad"><div className="val">{metrics.noEntregado}</div><div className="lbl">No recibidos</div></div>
        <div className="metric"><div className="val">{metrics.first8}</div><div className="lbl">Primeras 8</div></div>
        <div className="metric"><div className="val">{metrics.avgLot}</div><div className="lbl">Promedio lote {batchSize}</div></div>
      </div>

      <div className="card">
        <h3>Stock terminado</h3>
        <p className="small">Lo que ya está disponible para que el cliente lo reciba cuando lo pida.</p>
        <div className="grid-3" style={{ marginTop: 10 }}>
          <div className="metric"><div className="val">{stockBicolor}</div><div className="lbl">Bicolor</div></div>
          <div className="metric"><div className="val">{stockAmarillo}</div><div className="lbl">Amarillo</div></div>
          <div className="metric"><div className="val">{stockRojo}</div><div className="lbl">Rojo</div></div>
        </div>
      </div>

      <div className="card">
        <h3>Salida de lotes</h3>
        <p className="small">
          Línea A mide lotes de 8. Línea B mide lotes de 4; para completar las primeras 8 necesita dos lotes.
        </p>
        {latestLots.length === 0 && <p className="small mt-8">Aún no salió ningún lote completo al almacén.</p>}
        {latestLots.length > 0 && (
          <div className="grid" style={{ marginTop: 10 }}>
            {latestLots.map(lot => (
              <div key={lot.lotNumber} className="order-row">
                <strong>Lote {lot.lotNumber}</strong>
                <span className="status">{lot.quantity} und. · {lot.durationLabel}</span>
              </div>
            ))}
          </div>
        )}
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
  const disponibles = orders
    .filter(o => o.status === 'en_planificacion' || o.status === 'ensamble1')
    .sort((a, b) => a.sequence_number - b.sequence_number)

  // Aunque el planificador mande un lote de 8, el técnico recibe SOLO 1 unidad a la vez.
  const actual = disponibles[0]
  const cola = actual ? disponibles.filter(o => o.id !== actual.id) : []

  return (
    <div className="grid">
      <div className="alert alert-info">
        Arma la <strong>primera parte</strong> con LEGO. Cuando la pases físicamente, registra la transferencia.
      </div>

      {!actual && (
        <div className="card text-center"><p>Esperando pedido del Planificador...</p></div>
      )}

      {actual && (
        <>
          <ProductGuide product={actual.product} stage="alpha" />

          <div className="order-card urgent">
            <div className="order-row">
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                #{actual.sequence_number} <ProductPill p={actual.product} />
              </div>
              <span className="status">Unidad actual</span>
            </div>

            <button className="btn-full btn-success" onClick={() => {
              const now = new Date().toISOString()
              onUpdate(actual.id, {
                status: 'ensamble1_listo',
                ensamble1_start: now,
                ensamble1_end: now,
              })
            }}>
              Enviar a Ensamble 2
            </button>
          </div>

          {cola.length > 0 && (
            <div className="notice">
              Hay <strong>{cola.length}</strong> unidad(es) esperando. Cuando envíes esta, aparecerá la siguiente.
            </div>
          )}
        </>
      )}
    </div>
  )
}


// ─── ENSAMBLE 2 ──────────────────────────────────────────────────────────────
function Ensamble2Panel({ orders, onUpdate }: {
  orders: Order[], onUpdate: (id: string, d: Partial<Order>) => void,
}) {
  const disponibles = orders
    .filter(o => o.status === 'ensamble1_listo' || o.status === 'ensamble2')
    .sort((a, b) => a.sequence_number - b.sequence_number)

  // También recibe una sola unidad a la vez para evitar confusión.
  const actual = disponibles[0]
  const cola = actual ? disponibles.filter(o => o.id !== actual.id) : []

  return (
    <div className="grid">
      <div className="alert alert-info">
        Completa la <strong>segunda parte</strong>. Cuando la pases físicamente, registra la transferencia.
      </div>

      {!actual && (
        <div className="card text-center"><p>Esperando producto de Ensamble 1...</p></div>
      )}

      {actual && (
        <>
          <ProductGuide product={actual.product} stage="beta" />

          <div className="order-card urgent">
            <div className="order-row">
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                #{actual.sequence_number} <ProductPill p={actual.product} />
              </div>
              <span className="status">Unidad actual</span>
            </div>

            <button className="btn-full btn-success" onClick={() => {
              const now = new Date().toISOString()
              onUpdate(actual.id, {
                status: 'ensamble2_listo',
                ensamble2_start: now,
                ensamble2_end: now,
              })
            }}>
              Enviar al Horno
            </button>
          </div>

          {cola.length > 0 && (
            <div className="notice">
              Hay <strong>{cola.length}</strong> unidad(es) esperando. Cuando envíes esta, aparecerá la siguiente.
            </div>
          )}
        </>
      )}
    </div>
  )
}



// ─── HORNO ───────────────────────────────────────────────────────────────────
function HornoPanel({ orders, batches, session, room, setMsg }: {
  orders: Order[], batches: OvenBatch[], session: PlayerSession,
  room: Room | null, setMsg: (s: string) => void,
}) {
  const [nowTick, setNowTick] = useState(Date.now())
  const batchSize    = session.line === 'A' ? (room?.oven_a_batch || 8) : (room?.oven_b_batch || 4)
  const ovenDuration = room?.oven_duration_sec || 80

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 500)
    return () => clearInterval(interval)
  }, [])

  const readyOrders = orders
    .filter(o => o.status === 'ensamble2_listo' || o.status === 'esperando_horno')
    .sort((a, b) => a.sequence_number - b.sequence_number)

  const activeBatch = batches.find(b => b.status === 'procesando')
  const activeSeconds = activeBatch?.started_at
    ? Math.max(0, ovenDuration - (nowTick - new Date(activeBatch.started_at).getTime()) / 1000)
    : 0
  const activeReady = !!activeBatch && activeSeconds <= 0
  const inOven = orders
    .filter(o => o.status === 'en_horno')
    .sort((a, b) => new Date(a.horno_entry || a.created_at).getTime() - new Date(b.horno_entry || b.created_at).getTime())

  const stock = orders.filter(o => o.status === 'en_almacen')

  async function startOven() {
    setMsg('')
    if (activeBatch) {
      setMsg('El horno ya está procesando un lote.')
      return
    }
    if (readyOrders.length < batchSize) {
      setMsg(`Necesitas ${batchSize} productos para iniciar el horno`)
      return
    }

    const batchNum = (batches.length > 0 ? Math.max(...batches.map(b => b.batch_number)) : 0) + 1
    const startTime = new Date().toISOString()
    const readyAt = new Date(Date.now() + ovenDuration * 1000).toISOString()

    const { data: batch, error } = await supabase
      .from('oven_batches')
      .insert({
        room_id: session.roomId,
        line: session.line,
        batch_number: batchNum,
        status: 'procesando',
        started_at: startTime,
        ready_at: readyAt,
      })
      .select()
      .single()

    if (error || !batch) {
      setMsg(error?.message || 'Error al iniciar horno')
      return
    }

    const toProcess = readyOrders.slice(0, batchSize)
    await Promise.all(toProcess.map(o =>
      supabase.from('orders').update({ status: 'en_horno', horno_entry: startTime }).eq('id', o.id)
    ))
  }

  async function sendBatchToWarehouse() {
    setMsg('')
    if (!activeBatch) return
    if (!activeReady) {
      setMsg('El lote todavía no termina los 80 segundos.')
      return
    }

    const exitTime = new Date().toISOString()
    const toWarehouse = inOven.slice(0, batchSize)

    await supabase
      .from('oven_batches')
      .update({ status: 'liberado', released_at: exitTime })
      .eq('id', activeBatch.id)

    await Promise.all(toWarehouse.map(o =>
      supabase.from('orders').update({
        status: 'en_almacen',
        horno_exit: exitTime,
        almacen_entry: exitTime,
      }).eq('id', o.id)
    ))
  }

  return (
    <div className="grid">
      <div className={`oven-box ${activeBatch ? 'processing' : ''}`}>
        <div className="flex-between">
          <div>
            <h3>🔥 Horno {session.line}</h3>
            <p className="small">Lote: {batchSize} · {ovenDuration} segundos · salida manual al almacén</p>
          </div>
          {activeBatch ? (
            <div>
              <div className={`oven-timer ${activeReady ? '' : 'red'}`}>
                {activeReady
                  ? 'Listo'
                  : `${String(Math.floor(activeSeconds / 60)).padStart(2,'0')}:${String(Math.round(activeSeconds) % 60).padStart(2,'0')}`}
              </div>
              <div className="progress" style={{ width: 100 }}>
                <div className="progress-fill" style={{ width: `${Math.min(100, ((ovenDuration - activeSeconds) / ovenDuration) * 100)}%` }} />
              </div>
            </div>
          ) : (
            <div className="oven-timer" style={{ color: 'var(--muted)', fontSize: 18 }}>Vacío</div>
          )}
        </div>

        <div className="lote-dots" style={{ marginTop: 10 }}>
          {Array.from({ length: batchSize }).map((_, i) => (
            <div key={i} className={`lote-dot ${activeBatch ? 'filled' : i < readyOrders.length ? 'done' : ''}`} />
          ))}
        </div>

        {!activeBatch && <p className="small mt-8">{readyOrders.length} / {batchSize} productos listos para entrar</p>}
        {activeBatch && <p className="small mt-8">Horno cerrado: {inOven.length} producto(s) dentro.</p>}
      </div>

      {!activeBatch && readyOrders.length >= batchSize && (
        <button className="btn-full btn-xl" onClick={startOven}>
          🔥 Iniciar horno — cargar {batchSize} productos
        </button>
      )}

      {!activeBatch && readyOrders.length > 0 && readyOrders.length < batchSize && (
        <div className="alert alert-info">
          Faltan <strong>{batchSize - readyOrders.length}</strong> producto(s) para completar el lote.
        </div>
      )}

      {activeBatch && !activeReady && (
        <div className="alert alert-warn">
          El horno está procesando. No se puede enviar al almacén hasta que llegue a 00:00.
        </div>
      )}

      {activeBatch && activeReady && (
        <button className="btn-full btn-xl btn-success" onClick={sendBatchToWarehouse}>
          📦 Enviar lote al almacén
        </button>
      )}

      <div className="card">
        <h3>Cola del horno</h3>
        <p className="small">Productos listos para entrar: <strong>{readyOrders.length}</strong></p>
        <div className="flex" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {readyOrders.map(o => <span key={o.id}><ProductPill p={o.product} /></span>)}
          {readyOrders.length === 0 && <p className="small">Nada en espera</p>}
        </div>
      </div>

      <div className="card">
        <h3>Stock terminado actual</h3>
        <p className="small">Bicolor: <strong>{stock.filter(o => o.product === 'Bicolor').length}</strong> · Amarillo: <strong>{stock.filter(o => o.product === 'Amarillo').length}</strong> · Rojo: <strong>{stock.filter(o => o.product === 'Rojo').length}</strong></p>
      </div>
    </div>
  )
}



// ─── ALMACÉN ─────────────────────────────────────────────────────────────────
function AlmacenPanel({ orders, onUpdate }: {
  orders: Order[], onUpdate: (id: string, d: Partial<Order>) => void,
}) {
  const stock = orders.filter(o => o.status === 'en_almacen')
  const pendientesCliente = orders
    .filter(o => o.status === 'pendiente' && !o.client_verdict)
    .sort((a, b) => a.sequence_number - b.sequence_number)
  const pedidoActual = pendientesCliente[0]
  const stockPedido = pedidoActual ? stock.filter(o => o.product === pedidoActual.product) : []

  const enEnsamble1 = orders.filter(o => ['en_planificacion','ensamble1'].includes(o.status)).length
  const enEnsamble2 = orders.filter(o => ['ensamble1_listo','ensamble2'].includes(o.status)).length
  const esperandoHorno = orders.filter(o => ['ensamble2_listo','esperando_horno'].includes(o.status)).length
  const enHorno = orders.filter(o => o.status === 'en_horno').length

  async function entregarFisicamente() {
    if (!pedidoActual) return
    const item = stockPedido[0]
    if (!item) return
    const now = new Date().toISOString()

    // Sale físicamente del almacén y el stock baja.
    // El cliente todavía debe marcar: A tiempo / Tarde / No recibí.
    await onUpdate(item.id, {
      status: 'stock_consumido',
      delivered_at: now,
      notes: `Entregado físicamente para pedido #${pedidoActual.sequence_number}`,
    })
    await onUpdate(pedidoActual.id, {
      notes: 'entregado_por_almacen',
    })
  }

  return (
    <div className="grid">
      <div className="alert alert-info">
        Administra el stock terminado. Cuando haya producto para el pedido actual, entrégalo físicamente; el cliente registra el resultado en su pantalla.
      </div>

      <div className="card">
        <h3>Pedido actual del cliente</h3>
        {!pedidoActual && <p className="small">No hay pedido pendiente del cliente.</p>}
        {pedidoActual && (
          <>
            <div className="order-row" style={{ marginTop: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>#{pedidoActual.sequence_number} <ProductPill p={pedidoActual.product} /></div>
              <span className="status">Pendiente</span>
            </div>
            {stockPedido.length > 0 ? (
              <button className="btn-full btn-success" style={{ marginTop: 10 }} onClick={entregarFisicamente}>
                Entregar {PRODUCT_LABEL[pedidoActual.product]} al cliente
              </button>
            ) : (
              <div className="alert alert-warn" style={{ marginTop: 10 }}>
                Sin stock de {PRODUCT_LABEL[pedidoActual.product]}. Si llega antes del siguiente pedido, será entrega tarde; si no llega, será no recibido.
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h3>Stock terminado en almacén</h3>
        <div className="grid-3" style={{ marginTop: 10 }}>
          <div className="metric"><div className="val">{stock.filter(o => o.product === 'Bicolor').length}</div><div className="lbl">Bicolor</div></div>
          <div className="metric"><div className="val">{stock.filter(o => o.product === 'Amarillo').length}</div><div className="lbl">Amarillo</div></div>
          <div className="metric"><div className="val">{stock.filter(o => o.product === 'Rojo').length}</div><div className="lbl">Rojo</div></div>
        </div>
      </div>

      <div className="card">
        <h3>Productos en camino</h3>
        <div className="grid-2" style={{ gap: 8, marginTop: 10 }}>
          <div className="metric"><div className="val">{enEnsamble1}</div><div className="lbl">Ensamble 1</div></div>
          <div className="metric"><div className="val">{enEnsamble2}</div><div className="lbl">Ensamble 2</div></div>
          <div className="metric"><div className="val">{esperandoHorno}</div><div className="lbl">Cola horno</div></div>
          <div className="metric"><div className="val">{enHorno}</div><div className="lbl">En horno</div></div>
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
