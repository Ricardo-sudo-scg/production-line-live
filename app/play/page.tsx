"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { getSession, clearSession } from "../../lib/session";
import { PRODUCTS, type Order, type PlayerSession, type Product } from "../../lib/types";
import { getOrderCycleLabel, statusLabel } from "../../lib/metrics";

const stationConfig = {
  "Montaje 1": {
    title: "Montaje 1",
    visibleStatuses: ["pendiente", "montaje1"],
    startStatus: "pendiente",
    activeStatus: "montaje1",
    doneStatus: "montaje1_terminado",
    startField: "montaje1_start",
    endField: "montaje1_end",
  },
  "Montaje 2": {
    title: "Montaje 2",
    visibleStatuses: ["montaje1_terminado", "montaje2"],
    startStatus: "montaje1_terminado",
    activeStatus: "montaje2",
    doneStatus: "montaje2_terminado",
    startField: "montaje2_start",
    endField: "montaje2_end",
  },
} as const;

export default function PlayPage() {
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = getSession();
    if (!saved) {
      window.location.href = "/";
      return;
    }
    setSession(saved);
  }, []);

  useEffect(() => {
    if (!session) return;

    async function loadOrders() {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("room_code", session.roomCode)
        .eq("team", session.team)
        .eq("round", session.round)
        .order("created_at", { ascending: true });
      if (error) setMessage(error.message);
      setOrders((data || []) as Order[]);
      setLoading(false);
    }

    loadOrders();

    const channel = supabase
      .channel(`orders-play-${session.roomCode}-${session.team}-${session.round}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `room_code=eq.${session.roomCode}`,
        },
        () => loadOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [orders]
  );

  if (!session) return null;

  function leave() {
    clearSession();
    window.location.href = "/";
  }

  return (
    <main className="container">
      <section className="topbar">
        <div>
          <span className="badge">Sala {session.roomCode}</span>
          <h1>{session.role}</h1>
          <p>
            {session.name} · Equipo {session.team} · Ronda {session.round}
          </p>
        </div>
        <div className="actions">
          <a className="button light-btn" href="/dashboard">Dashboard</a>
          <button className="secondary" onClick={leave}>Salir</button>
        </div>
      </section>

      {message && <p className="notice">{message}</p>}
      {loading && <p>Cargando pedidos...</p>}

      {session.role === "Cliente" && (
        <ClientePanel session={session} orders={sortedOrders} setMessage={setMessage} />
      )}
      {session.role === "Montaje 1" && (
        <StationPanel session={session} orders={sortedOrders} station="Montaje 1" setMessage={setMessage} />
      )}
      {session.role === "Montaje 2" && (
        <StationPanel session={session} orders={sortedOrders} station="Montaje 2" setMessage={setMessage} />
      )}
      {session.role === "Calidad" && (
        <QualityPanel session={session} orders={sortedOrders} setMessage={setMessage} />
      )}
      {session.role === "Despacho" && (
        <DispatchPanel session={session} orders={sortedOrders} setMessage={setMessage} />
      )}
      {session.role === "Profesor" && (
        <section className="card">
          <h2>Modo profesor</h2>
          <p>Para ver el tablero general, abre el dashboard.</p>
          <a className="button" href="/dashboard">Ir al dashboard</a>
        </section>
      )}
    </main>
  );
}

function ClientePanel({
  session,
  orders,
  setMessage,
}: {
  session: PlayerSession;
  orders: Order[];
  setMessage: (value: string) => void;
}) {
  async function createOrder(product: Product) {
    setMessage("");
    const { error } = await supabase.from("orders").insert({
      room_code: session.roomCode,
      team: session.team,
      round: session.round,
      product,
      status: "pendiente",
      requested_by: session.name,
      error_count: 0,
    });
    if (error) setMessage(error.message);
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>Crear pedido</h2>
        <p>Presiona el producto que pide el cliente. El LEGO se arma físicamente; aquí solo registras la demanda.</p>
        <div className="grid-3">
          {PRODUCTS.map((product) => (
            <button key={product} onClick={() => createOrder(product)}>
              Pedir {product}
            </button>
          ))}
        </div>
      </section>
      <RecentOrders orders={orders.slice(-8).reverse()} />
    </div>
  );
}

function StationPanel({
  session,
  orders,
  station,
  setMessage,
}: {
  session: PlayerSession;
  orders: Order[];
  station: "Montaje 1" | "Montaje 2";
  setMessage: (value: string) => void;
}) {
  const config = stationConfig[station];
  const visibleOrders = orders.filter((order) =>
    (config.visibleStatuses as readonly string[]).includes(order.status)
  );

  async function start(order: Order) {
    setMessage("");
    const { error } = await supabase
      .from("orders")
      .update({
        status: config.activeStatus,
        current_station: station,
        [config.startField]: new Date().toISOString(),
      })
      .eq("id", order.id);
    if (error) setMessage(error.message);
  }

  async function finish(order: Order) {
    setMessage("");
    const { error } = await supabase
      .from("orders")
      .update({
        status: config.doneStatus,
        current_station: null,
        [config.endField]: new Date().toISOString(),
      })
      .eq("id", order.id);
    if (error) setMessage(error.message);
  }

  return (
    <section className="card">
      <h2>{config.title}</h2>
      <p>Toma el pedido, arma tu parte con LEGO y registra cuando termines.</p>
      <div className="grid">
        {visibleOrders.length === 0 && <p className="notice">No hay pedidos para esta estación.</p>}
        {visibleOrders.map((order) => (
          <article key={order.id} className="order-card">
            <OrderHeader order={order} />
            <div className="actions">
              {order.status === config.startStatus && (
                <button onClick={() => start(order)}>Tomar pedido</button>
              )}
              {order.status === config.activeStatus && (
                <button className="success" onClick={() => finish(order)}>Terminé mi parte</button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function QualityPanel({
  orders,
  setMessage,
}: {
  session: PlayerSession;
  orders: Order[];
  setMessage: (value: string) => void;
}) {
  const visibleOrders = orders.filter((order) => order.status === "montaje2_terminado");

  async function mark(order: Order, quality: "OK" | "Error") {
    setMessage("");
    const { error } = await supabase
      .from("orders")
      .update({
        status: quality === "OK" ? "listo_para_entrega" : "error",
        quality,
        quality_start: new Date().toISOString(),
        error_count: quality === "OK" ? order.error_count : order.error_count + 1,
        current_station: null,
      })
      .eq("id", order.id);
    if (error) setMessage(error.message);
  }

  return (
    <section className="card">
      <h2>Calidad</h2>
      <p>Revisa físicamente el LEGO y marca si el producto está correcto o tiene error.</p>
      <div className="grid">
        {visibleOrders.length === 0 && <p className="notice">No hay productos listos para revisar.</p>}
        {visibleOrders.map((order) => (
          <article key={order.id} className="order-card">
            <OrderHeader order={order} />
            <div className="actions">
              <button className="success" onClick={() => mark(order, "OK")}>OK</button>
              <button className="danger" onClick={() => mark(order, "Error")}>Error</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DispatchPanel({
  orders,
  setMessage,
}: {
  session: PlayerSession;
  orders: Order[];
  setMessage: (value: string) => void;
}) {
  const visibleOrders = orders.filter((order) => order.status === "listo_para_entrega");

  async function deliver(order: Order) {
    setMessage("");
    const { error } = await supabase
      .from("orders")
      .update({
        status: "entregado",
        delivered_at: new Date().toISOString(),
        current_station: null,
      })
      .eq("id", order.id);
    if (error) setMessage(error.message);
  }

  return (
    <section className="card">
      <h2>Despacho</h2>
      <p>Entrega el producto físico al cliente y registra la entrega final.</p>
      <div className="grid">
        {visibleOrders.length === 0 && <p className="notice">No hay pedidos listos para despacho.</p>}
        {visibleOrders.map((order) => (
          <article key={order.id} className="order-card">
            <OrderHeader order={order} />
            <button className="success" onClick={() => deliver(order)}>Entregado al cliente</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function OrderHeader({ order }: { order: Order }) {
  return (
    <div className="order-title">
      <div>
        <strong>{order.product}</strong>
        <div className="small">
          Pedido {order.id.slice(0, 6)} · {new Date(order.created_at).toLocaleTimeString()}
        </div>
      </div>
      <span className={`status ${order.status}`}>{statusLabel(order.status)}</span>
    </div>
  );
}

function RecentOrders({ orders }: { orders: Order[] }) {
  return (
    <section className="card">
      <h2>Últimos pedidos</h2>
      <div className="grid">
        {orders.length === 0 && <p>Aún no hay pedidos.</p>}
        {orders.map((order) => (
          <article key={order.id} className="order-card">
            <OrderHeader order={order} />
            <p className="small">Tiempo de ciclo: {getOrderCycleLabel(order)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
