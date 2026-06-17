"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Order } from "../../lib/types";
import { calculateMetrics, getOrderCycleLabel, statusLabel } from "../../lib/metrics";

export default function DashboardPage() {
  const [roomCode, setRoomCode] = useState("UTEC01");
  const [team, setTeam] = useState("TODOS");
  const [round, setRound] = useState(1);
  const [lateLimit, setLateLimit] = useState(180);
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadOrders() {
      let query = supabase
        .from("orders")
        .select("*")
        .eq("room_code", roomCode.trim().toUpperCase())
        .eq("round", round)
        .order("created_at", { ascending: true });

      if (team !== "TODOS") query = query.eq("team", team);

      const { data, error } = await query;
      if (error) setMessage(error.message);
      else setMessage("");
      setOrders((data || []) as Order[]);
    }

    loadOrders();

    const channel = supabase
      .channel(`orders-dashboard-${roomCode}-${team}-${round}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `room_code=eq.${roomCode.trim().toUpperCase()}`,
        },
        () => loadOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, team, round]);

  const metrics = useMemo(() => calculateMetrics(orders, lateLimit), [orders, lateLimit]);
  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [orders]
  );

  return (
    <main className="container">
      <section className="topbar">
        <div>
          <span className="badge">Dashboard en vivo</span>
          <h1>Production Line Live</h1>
          <p>Proyecta esta pantalla mientras los estudiantes producen físicamente con LEGO.</p>
        </div>
        <div className="actions">
          <a className="button light-btn" href="/">Ingreso</a>
          <a className="button secondary" href="/admin">Admin</a>
        </div>
      </section>

      {message && <p className="notice">{message}</p>}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="grid-3">
          <label>
            Sala
            <input value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} />
          </label>
          <label>
            Equipo
            <select value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="TODOS">Todos</option>
              <option value="A">Equipo A</option>
              <option value="B">Equipo B</option>
              <option value="C">Equipo C</option>
              <option value="D">Equipo D</option>
            </select>
          </label>
          <label>
            Ronda
            <select value={round} onChange={(e) => setRound(Number(e.target.value))}>
              {[1, 2, 3].map((item) => (
                <option key={item} value={item}>Ronda {item}</option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ marginTop: 14 }}>
          <label>
            Límite para considerar tarde, en segundos
            <input
              type="number"
              min={30}
              value={lateLimit}
              onChange={(e) => setLateLimit(Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="grid-3" style={{ marginBottom: 16 }}>
        <Metric label="Pedidos totales" value={metrics.total} />
        <Metric label="Entregados" value={metrics.delivered} />
        <Metric label="WIP actual" value={metrics.wip} />
        <Metric label="Errores" value={metrics.errors} />
        <Metric label="Tardes" value={metrics.late} />
        <Metric label="Tiempo promedio" value={metrics.avgCycleLabel} />
        <Metric label="Calidad" value={`${metrics.qualityRate}%`} />
        <Metric label="A tiempo" value={`${metrics.onTimeRate}%`} />
        <Metric label="Cuello de botella" value={metrics.bottleneck} />
      </section>

      <section className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>Cola por estación</h2>
          <div className="grid">
            {Object.entries(metrics.stationCounts).map(([station, count]) => (
              <div key={station} className="order-title">
                <strong>{station}</strong>
                <span className="badge">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Lectura rápida</h2>
          <p>
            Si una estación acumula más pedidos que las demás, ahí puede estar el cuello de botella.
            La mejora se observa comparando rondas: menos WIP, menos errores y menor tiempo promedio.
          </p>
        </div>
      </section>

      <section className="card">
        <h2>Pedidos en vivo</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Equipo</th>
                <th>Producto</th>
                <th>Estado</th>
                <th>Calidad</th>
                <th>Tiempo</th>
                <th>Pedido</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map((order) => (
                <tr key={order.id}>
                  <td>{new Date(order.created_at).toLocaleTimeString()}</td>
                  <td>{order.team}</td>
                  <td>{order.product}</td>
                  <td><span className={`status ${order.status}`}>{statusLabel(order.status)}</span></td>
                  <td>{order.quality || "-"}</td>
                  <td>{getOrderCycleLabel(order)}</td>
                  <td>{order.id.slice(0, 6)}</td>
                </tr>
              ))}
              {sortedOrders.length === 0 && (
                <tr>
                  <td colSpan={7}>Aún no hay pedidos en esta sala/ronda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
