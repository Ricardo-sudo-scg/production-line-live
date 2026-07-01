'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { getSession, clearSession } from '../../lib/session'
import {
  ORDER_STATUS_LABEL, PLAN_422, PLAN_844, PRODUCT_COLOR, PRODUCT_LABEL,
  type Order, type OvenBatch, type PlayerSession, type Product, type Room,
} from '../../lib/types'

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

          <div style={{ position: 'absolute', left: 36, right: 36, bottom: 28, fontSize: 12, fontWeight: 700, color: '#475569', textAlign: 'center' }}>
            Cuando termines, pásala a Ensamble 2.
          </div>
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
            Arma la base que recibirá Ensamble 2.
          </div>
          <LegoBlock color={LEGO.yellow} x={52} y={260} w={186} h={72} label="base amarilla 4x2" />
          <LegoBlock color={LEGO.blue} x={99} y={140} w={92} h={92} label="azul 2x2" />
          <div style={{ position: 'absolute', left: 36, right: 36, bottom: 28, fontSize: 12, fontWeight: 700, color: '#475569', textAlign: 'center' }}>
            Cuando termines, pásala a Ensamble 2.
          </div>
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
            Arma la base que recibirá Ensamble 2.
          </div>
          <LegoBlock color={LEGO.red} x={52} y={260} w={186} h={72} label="base roja 4x2" />
          <LegoBlock color={LEGO.yellow} x={99} y={140} w={92} h={92} label="amarillo 2x2" />
          <div style={{ position: 'absolute', left: 36, right: 36, bottom: 28, fontSize: 12, fontWeight: 700, color: '#475569', textAlign: 'center' }}>
            Cuando termines, pásala a Ensamble 2.
          </div>
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

  const instructions: Record<Product, { alpha: string[]; beta: string[] }> = {
    Bicolor: {
      alpha: [
        'Arma la estructura base completa que recibirá Ensamble 2.',
        'Incluye: verde 2x2, rojo 2x2, verde 2x1 y amarillo 2x1.',
        'Pasa la pieza a Ensamble 2.',
      ],
      beta: [
        'Recibe la estructura base ya armada por Alpha.',
        'No vuelvas a armar la base: solo agrega las piezas marcadas.',
        'Agrega arriba amarillo 2x1 y abajo rojo 1x1 + blanco 1x1.',
      ],
    },
    Amarillo: {
      alpha: [
        'Coloca la base amarilla 4x2.',
        'Coloca el bloque azul 2x2 al centro.',
        'Pasa la pieza a Ensamble 2.',
      ],
      beta: [
        'Recibe la base amarilla con el bloque azul ya armados por Alpha.',
        'No vuelvas a armar la base: solo agrega las piezas marcadas.',
        'Agrega rojo 2x1, verde 1x1 y rojo 1x1.',
      ],
    },
    Rojo: {
      alpha: [
        'Coloca la base roja 4x2.',
        'Coloca el bloque amarillo 2x2 al centro.',
        'Pasa la pieza a Ensamble 2.',
      ],
      beta: [
        'Recibe la base roja con el bloque amarillo ya armados por Alpha.',
        'No vuelvas a armar la base: solo agrega las piezas marcadas.',
        'Agrega verde 2x1, azul 1x1 y verde 1x1.',
      ],
    },
  }

  return (
    <div className="card" style={{ textAlign: 'center', padding: 16 }}>
      <h3 style={{ marginBottom: 8 }}>{title} — Pieza {product}</h3>
      <p className="small" style={{ marginBottom: 12 }}>
        Mira la guía, arma solo tu parte y pásala a la siguiente estación.
      </p>

      <ProductDiagram product={product} stage={stage} />

      <div style={{ marginTop: 12, textAlign: 'left' }}>
        {instructions[product][stage].map((item, index) => (
          <p key={item} className="small" style={{ margin: '4px 0' }}>
            <strong>{index + 1}.</strong> {item}
          </p>
        ))}
      </div>
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
            <PlanificadorPanel orders={orders} session={session} onUpdate={update} />}
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
function PlanificadorPanel({ orders, session, onUpdate }: {
  orders: Order[], session: PlayerSession,
  onUpdate: (id: string, d: Partial<Order>) => void,
}) {
  const plan      = session.line === 'A' ? PLAN_844 : PLAN_422
  const batchSize = session.line === 'A' ? 8 : 4
  const planName  = session.line === 'A' ? '8:4:4' : '4:2:2'

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
        <div className="metric good"><div className="val">{entregados.length}</div><div className="lbl">Entregados</div></div>
        <div className="metric bad"><div className="val">{orders.filter(o => o.status === 'no_entregado').length}</div><div className="lbl">No recibidos</div></div>
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
  const [ovenTime, setOvenTime] = useState<Record<string, number>>({})
  const batchSize   = session.line === 'A' ? (room?.oven_a_batch || 8) : (room?.oven_b_batch || 4)
  const ovenDuration = room?.oven_duration_sec || 80

  useEffect(() => {
    const interval = setInterval(() => {
      const processing = batches.filter(b => b.status === 'procesando')
      const newTimes: Record<string, number> = {}
      processing.forEach(b => {
        if (b.started_at) {
          const elapsed = (Date.now() - new Date(b.started_at).getTime()) / 1000
          newTimes[b.id] = Math.max(0, ovenDuration - elapsed)
        }
      })
      setOvenTime(newTimes)
    }, 500)
    return () => clearInterval(interval)
  }, [batches, ovenDuration])

  const readyOrders  = orders.filter(o => o.status === 'ensamble2_listo' || o.status === 'esperando_horno')
  const activeBatch  = batches.find(b => b.status === 'procesando')
  const readyBatches = batches.filter(b => b.status === 'listo')

  async function startOven() {
    if (readyOrders.length < batchSize) {
      setMsg(`Necesitas ${batchSize} productos para iniciar el horno`)
      return
    }
    const batchNum = (batches.length > 0 ? Math.max(...batches.map(b => b.batch_number)) : 0) + 1
    const now      = new Date().toISOString()
    const readyAt  = new Date(Date.now() + ovenDuration * 1000).toISOString()

    const { data: batch, error } = await supabase.from('oven_batches').insert({
      room_id:      session.roomId,
      line:         session.line,
      batch_number: batchNum,
      status:       'procesando',
      started_at:   now,
      ready_at:     readyAt,
    }).select().single()

    if (error || !batch) { setMsg(error?.message || 'Error al iniciar horno'); return }

    const toProcess = readyOrders.slice(0, batchSize)
    await Promise.all(toProcess.map(o =>
      supabase.from('orders').update({ status: 'en_horno', horno_entry: now }).eq('id', o.id)
    ))

    // Liberación automática al terminar los 80 segundos
    setTimeout(async () => {
      const exitTime = new Date().toISOString()
      await supabase.from('oven_batches').update({ status: 'liberado', released_at: exitTime }).eq('id', batch.id)
      await Promise.all(toProcess.map(o =>
        supabase.from('orders').update({
          status:       'en_almacen',
          horno_exit:   exitTime,
          almacen_entry: exitTime,
        }).eq('id', o.id)
      ))
    }, ovenDuration * 1000)
  }

  return (
    <div className="grid">
      <div className={`oven-box ${activeBatch?.status === 'procesando' ? 'processing' : readyBatches.length > 0 ? 'ready' : ''}`}>
        <div className="flex-between">
          <div>
            <h3>🔥 Horno {session.line}</h3>
            <p className="small">Lote: {batchSize} · {ovenDuration} segundos · libera automático</p>
          </div>
          {activeBatch?.status === 'procesando' && ovenTime[activeBatch.id] !== undefined ? (
            <div>
              <div className="oven-timer red">
                {String(Math.floor(ovenTime[activeBatch.id] / 60)).padStart(2,'0')}:{String(Math.round(ovenTime[activeBatch.id]) % 60).padStart(2,'0')}
              </div>
              <div className="progress" style={{ width: 100 }}>
                <div className="progress-fill" style={{ width: `${((ovenDuration - ovenTime[activeBatch.id]) / ovenDuration) * 100}%` }} />
              </div>
            </div>
          ) : (
            <div className="oven-timer" style={{ color: 'var(--muted)', fontSize: 18 }}>
              {readyBatches.length > 0 ? '¡Listo!' : 'Vacío'}
            </div>
          )}
        </div>

        <div className="lote-dots" style={{ marginTop: 10 }}>
          {Array.from({ length: batchSize }).map((_, i) => (
            <div key={i} className={`lote-dot ${
              i < readyOrders.length
                ? (activeBatch ? 'filled' : 'done')
                : ''
            }`} />
          ))}
        </div>
        <p className="small mt-8">{readyOrders.length} / {batchSize} productos listos para entrar</p>
      </div>

      {activeBatch?.status === 'procesando' && (
        <div className="alert alert-warn">
          El horno está procesando. Se liberará automáticamente al terminar.
        </div>
      )}

      {!activeBatch && readyOrders.length >= batchSize && (
        <button className="btn-full btn-xl" onClick={startOven}>
          🔥 Iniciar Horno — {batchSize} productos
        </button>
      )}

      {!activeBatch && readyOrders.length < batchSize && readyOrders.length > 0 && (
        <div className="alert alert-info">
          Esperando {batchSize - readyOrders.length} producto(s) más para completar el lote.
        </div>
      )}

      <div className="card">
        <h3>En espera del horno ({readyOrders.length})</h3>
        <div className="flex" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {readyOrders.map(o => <span key={o.id}><ProductPill p={o.product} /></span>)}
          {readyOrders.length === 0 && <p className="small">Nada en espera</p>}
        </div>
      </div>

      <div className="card">
        <h3>Lotes procesados: {batches.filter(b => b.status === 'liberado').length}</h3>
      </div>
    </div>
  )
}

// ─── ALMACÉN ─────────────────────────────────────────────────────────────────
function AlmacenPanel({ orders, onUpdate }: {
  orders: Order[], onUpdate: (id: string, d: Partial<Order>) => void,
}) {
  const enAlmacen = orders.filter(o => o.status === 'en_almacen')
  return (
    <div className="grid">
      <div className="alert alert-info">
        Cuando el cliente pida un producto, entrégaselo físicamente y regístralo aquí.
      </div>
      {enAlmacen.length === 0 && (
        <div className="card text-center"><p>No hay productos en almacén aún.</p></div>
      )}
      {enAlmacen.map(o => (
        <div key={o.id} className="order-card">
          <div className="order-row">
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              #{o.sequence_number} <ProductPill p={o.product} />
            </div>
          </div>
          <div className="grid-2" style={{ gap: 8 }}>
            <button className="btn-success" style={{ fontSize: 13, minHeight: 44 }}
              onClick={() => onUpdate(o.id, {
                status: 'entregado_ok',
                client_verdict: 'ok',
                delivered_at: new Date().toISOString(),
              })}>
              ✓ Entregado a tiempo
            </button>
            <button className="btn-warning" style={{ fontSize: 13, minHeight: 44 }}
              onClick={() => onUpdate(o.id, {
                status: 'entregado_tarde',
                client_verdict: 'tarde',
                delivered_at: new Date().toISOString(),
              })}>
              ⚠ Entregado tarde
            </button>
          </div>
          <button className="btn-full btn-danger" style={{ fontSize: 12, minHeight: 38, marginTop: 6 }}
            onClick={() => onUpdate(o.id, {
              status: 'no_entregado',
              client_verdict: 'no_entregado',
              delivered_at: new Date().toISOString(),
            })}>
            ✗ No entregado
          </button>
        </div>
      ))}
      <div className="card">
        <div className="grid-3">
          <div className="metric good"><div className="val">{orders.filter(o => o.status === 'entregado_ok').length}</div><div className="lbl">A tiempo</div></div>
          <div className="metric warn"><div className="val">{orders.filter(o => o.status === 'entregado_tarde').length}</div><div className="lbl">Tarde</div></div>
          <div className="metric bad"><div className="val">{orders.filter(o => o.status === 'no_entregado').length}</div><div className="lbl">No recibidos</div></div>
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
