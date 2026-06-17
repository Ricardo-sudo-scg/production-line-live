"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { clearSession, getSession } from "../../lib/session";
import { PRODUCTS, type Order, type PlayerSession, type Product } from "../../lib/types";
import { getOrderCycleLabel, statusLabel } from "../../lib/metrics";

export default function PlayPage() {
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const savedSession = getSession();
    if (!savedSession) {
      window.location.href = "/";
      return;
    }
    setSession(savedSession);
  }, []);

  useEffect(() => {
    if (!session) return;
    const activeSession = session;

    async function loadOrders() {
      let statusFilter: string[] = [];

      if (activeSession.role === "Montaje 1") {
        statusFilter = ["pendiente", "montaje1"];
      } else if (activeSession.role === "Montaje 2") {
        statusFilter = ["montaje1_terminado", "montaje2"];
      } else if (activeSession.role === "Calidad") {
        statusFilter = ["montaje2_terminado"];
      } else if (activeSession.role === "Despacho") {
        statusFilter = ["listo_para_entrega"];
      } else {
        statusFilter = [
          "pendiente",
          "montaje1",
          "montaje1_terminado",
          "montaje2",
          "montaje2_terminado",
          "listo_para_entrega",
          "error",
          "entregado",
        ];
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("room_code", activeSession.roomCode)
        .eq("team", activeSession.team)
        .eq("round", activeSession.round)
        .in("status", statusFilter)
        .order("created_at", { ascending: true });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("");
      setOrders((data || []) as Order[]);
    }

    loadOrders();

    const channel = supabase
      .channel(`orders-play-${activeSession.roomCode}-${activeSession.team}-${activeSession.round}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `room_code=eq.${activeSession.roomCode}`,
        },
        () => loadOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const visibleOrders = useMemo(() => orders, [orders]);

  async function createOrder(product: Product) {
    if (!session) return;

    const { error } = await supabase.from("orders").insert({
      room_code: session.roomCode,
      team: session.team,
      round: session.round,
      product,
      status: "pendiente",
      requested_by: session.name,
      current_station: "Cliente",
      error_count: 0,
    });

    if (error) setMessage(error.message);
    else setMessage(`Pedido ${product} creado.`);
  }

  async function updateOrder(order: Order, nextAction: string) {
    const now = new Date().toISOString();
    let updateData: Record<string, string | number | null> = {};

    if (nextAction === "start_m1") {
      updateData = {
        status: "montaje1",
        montaje1_start: now,
        current_station: "Montaje 1",
      };
    }

    if (nextAction === "finish_m1") {
      updateData = {
        status: "montaje1_terminado",
        montaje1_end: now,
        current_station: "Montaje 2",
      };
    }

    if (nextAction === "start_m2") {
      updateData = {
        status: "montaje2",
        montaje2_start: now,
        current_station: "Montaje 2",
      };
    }

    if (nextAction === "finish_m2") {
      updateData = {
        status: "montaje2_terminado",
        montaje2_end: now,
        current_station: "Calidad",
      };
    }

    if (nextAction === "quality_ok") {
      updateData = {
        status: "listo_para_entrega",
        quality_start: now,
        quality: "OK",
        current_station: "Despacho",
      };
    }

    if (nextAction === "quality_error") {
      updateData = {
        status: "error",
        quality_start: now,
        quality: "Error",
        error_count: (order.error_count || 0) + 1,
        current_station: "Calidad",
      };
    }

    if (nextAction === "delivered") {
      updateData = {
        status: "entregado",
        delivered_at: now,
        current_station: "Entregado",
      };
    }

    const { error } = await supabase.from("orders").update(updateData).eq("id", order.id);

    if (error) setMessage(error.message);
    else setMessage("Pedido actualizado.");
  }

  function logout() {
    clearSession();
    window.location.href = "/";
  }

  if (!session) {
    return (
      <main className="container">
        <section className="card">
          <h1>Cargando sesión...</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <section className="topbar">
        <div>
          <span className="badge">Modo estudiante</span>
          <h1>{session.role}</h1>
          <p>
            Sala {session.roomCode} · Equipo {session.team} · Ronda {session.round}
          </p>
        </div>
        <div className="actions">
          <a className="button light-btn" href="/dashboard">
            Dashboard
          </a>
          <button className="secondary" onClick={logout}>
            Salir
          </button>
        </div>
      </section>

      {message && <p className="notice">{message}</p>}

      {session.role === "Cliente" && (
        <section className="card">
          <h2>Crear pedido del cliente</h2>
          <p>Presiona el producto que el cliente pide. El pedido aparecerá en la línea.</p>
          <div className="grid-3">
            {PRODUCTS.map((product) => (
              <button key={product} onClick={() => createOrder(product)}>
                Pedir {product}
              </button>
            ))}
          </div>
        </section>
      )}

      {session.role !== "Cliente" && (
        <section className="card">
          <h2>Pedidos para tu estación</h2>

          <div className="grid">
            {visibleOrders.map((order) => (
              <div key={order.id} className="order-card">
                <div className="order-title">
                  <strong>{order.product}</strong>
                  <span className={`status ${order.status}`}>{statusLabel(order.status)}</span>
                </div>

                <p className="small">
                  Pedido {order.id.slice(0, 6)} · Tiempo {getOrderCycleLabel(order)}
                </p>

                <div className="actions">
                  {session.role === "Montaje 1" && order.status === "pendiente" && (
                    <button onClick={() => updateOrder(order, "start_m1")}>Tomar pedido</button>
                  )}

                  {session.role === "Montaje 1" && order.status === "montaje1" && (
                    <button onClick={() => updateOrder(order, "finish_m1")}>Terminé Montaje 1</button>
                  )}

                  {session.role === "Montaje 2" && order.status === "montaje1_terminado" && (
                    <button onClick={() => updateOrder(order, "start_m2")}>Iniciar Montaje 2</button>
                  )}

                  {session.role === "Montaje 2" && order.status === "montaje2" && (
                    <button onClick={() => updateOrder(order, "finish_m2")}>Terminé Montaje 2</button>
                  )}

                  {session.role === "Calidad" && order.status === "montaje2_terminado" && (
                    <>
                      <button onClick={() => updateOrder(order, "quality_ok")}>OK</button>
                      <button className="danger" onClick={() => updateOrder(order, "quality_error")}>
                        Error
                      </button>
                    </>
                  )}

                  {session.role === "Despacho" && order.status === "listo_para_entrega" && (
                    <button onClick={() => updateOrder(order, "delivered")}>Entregado al cliente</button>
                  )}
                </div>
              </div>
            ))}

            {visibleOrders.length === 0 && (
              <p className="small">Aún no hay pedidos para esta estación.</p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
