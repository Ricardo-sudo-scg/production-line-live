"use client";

import { FormEvent, useState } from "react";
import { PRODUCTS, ROLES, TEAMS, type Role } from "../lib/types";
import { saveSession } from "../lib/session";

export default function HomePage() {
  const [roomCode, setRoomCode] = useState("UTEC01");
  const [name, setName] = useState("");
  const [team, setTeam] = useState("A");
  const [round, setRound] = useState(1);
  const [role, setRole] = useState<Role>("Cliente");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveSession({
      roomCode: roomCode.trim().toUpperCase(),
      name: name.trim() || "Estudiante",
      team,
      round,
      role,
    });
    window.location.href = role === "Profesor" ? "/dashboard" : "/play";
  }

  return (
    <main className="hero">
      <section className="card hero-card">
        <span className="badge">Production Line Live</span>
        <h1 style={{ marginTop: 14 }}>Juego LEGO con datos en vivo</h1>
        <p>
          Los estudiantes arman físicamente Bicolor, Amarillo y Rojo. Esta app registra pedidos,
          tiempos, calidad y entregas desde el celular.
        </p>

        <form className="grid" onSubmit={handleSubmit}>
          <label>
            Código de sala
            <input value={roomCode} onChange={(e) => setRoomCode(e.target.value)} />
          </label>
          <label>
            Nombre
            <input
              placeholder="Ej. Ricardo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="grid-2">
            <label>
              Equipo
              <select value={team} onChange={(e) => setTeam(e.target.value)}>
                {TEAMS.map((item) => (
                  <option key={item} value={item}>
                    Equipo {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ronda
              <select value={round} onChange={(e) => setRound(Number(e.target.value))}>
                {[1, 2, 3].map((item) => (
                  <option key={item} value={item}>
                    Ronda {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Rol
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <button type="submit">Entrar al juego</button>
          <a className="button light-btn" href="/dashboard">
            Ver dashboard del profesor
          </a>
        </form>

        <p className="small">
          Productos disponibles: {PRODUCTS.join(", ")}. No reemplaza el LEGO; solo digitaliza la información.
        </p>
      </section>
    </main>
  );
}
