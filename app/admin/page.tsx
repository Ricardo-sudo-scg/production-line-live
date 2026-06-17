"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { PRODUCTS } from "../../lib/types";

export default function AdminPage() {
  const [roomCode, setRoomCode] = useState("UTEC01");
  const [team, setTeam] = useState("A");
  const [round, setRound] = useState(1);
  const [message, setMessage] = useState("");

  async function resetRound() {
    const ok = confirm(`¿Eliminar pedidos de sala ${roomCode}, equipo ${team}, ronda ${round}?`);
    if (!ok) return;
    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("room_code", roomCode.trim().toUpperCase())
      .eq("team", team)
      .eq("round", round);

    setMessage(error ? error.message : "Ronda reiniciada correctamente.");
  }

  async function createProgram442() {
    const sequence = ["Bicolor", "Bicolor", "Bicolor", "Bicolor", "Amarillo", "Amarillo", "Rojo", "Rojo"];
    const rows = sequence.map((product) => ({
      room_code: roomCode.trim().toUpperCase(),
      team,
      round,
      product,
      status: "pendiente",
      requested_by: "Programa 4:2:2",
      error_count: 0,
    }));
    const { error } = await supabase.from("orders").insert(rows);
    setMessage(error ? error.message : "Programa 4:2:2 cargado como pedidos pendientes.");
  }

  async function createProgram844() {
    const sequence = [
      ...Array(8).fill("Bicolor"),
      ...Array(4).fill("Amarillo"),
      ...Array(4).fill("Rojo"),
    ];
    const rows = sequence.map((product) => ({
      room_code: roomCode.trim().toUpperCase(),
      team,
      round,
      product,
      status: "pendiente",
      requested_by: "Programa 8:4:4",
      error_count: 0,
    }));
    const { error } = await supabase.from("orders").insert(rows);
    setMessage(error ? error.message : "Programa 8:4:4 cargado como pedidos pendientes.");
  }

  return (
    <main className="container">
      <section className="topbar">
        <div>
          <span className="badge">Admin</span>
          <h1>Control de la simulación</h1>
          <p>Usa esta pantalla para preparar una sala o cargar pedidos de prueba.</p>
        </div>
        <div className="actions">
          <a className="button light-btn" href="/">Ingreso</a>
          <a className="button secondary" href="/dashboard">Dashboard</a>
        </div>
      </section>

      {message && <p className="notice">{message}</p>}

      <section className="card grid">
        <div className="grid-3">
          <label>
            Sala
            <input value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} />
          </label>
          <label>
            Equipo
            <select value={team} onChange={(e) => setTeam(e.target.value)}>
              {['A', 'B', 'C', 'D'].map((item) => (
                <option key={item} value={item}>Equipo {item}</option>
              ))}
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

        <div className="actions">
          <button className="danger" onClick={resetRound}>Reiniciar ronda</button>
          <button className="warning" onClick={createProgram442}>Cargar programa 4:2:2</button>
          <button onClick={createProgram844}>Cargar programa 8:4:4</button>
        </div>

        <p className="small">
          Productos configurados: {PRODUCTS.join(", ")}. Los programas crean pedidos pendientes para que la línea los procese.
        </p>
      </section>
    </main>
  );
}
