'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { saveSession } from '../lib/session'
import { COMPANY_ROLES, DEMAND_SEQUENCE_T1, type Line, type Role } from '../lib/types'

export default function HomePage() {
  const [name, setName]       = useState('')
  const [roomId, setRoomId]   = useState('OPEN2026')
  const [role, setRole]       = useState<Role>('Técnico de Fabricación Alpha')
  const [line, setLine]       = useState<Line>('A')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function ensureRoom(rid: string) {
    const { data } = await supabase.from('rooms').select('id').eq('id', rid).single()
    if (!data) {
      await supabase.from('rooms').insert({
        id: rid,
        status: 'waiting',
        demand_sequence:   DEMAND_SEQUENCE_T1,
        demand_interval_sec: 20,
        oven_a_batch:      8,
        oven_b_batch:      4,
        oven_duration_sec: 80,
        prep_time_sec:     60,
      })
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Escribe tu nombre'); return }
    setLoading(true); setError('')
    const rid = roomId.trim().toUpperCase()
    await ensureRoom(rid)
    const { data: player, error: pErr } = await supabase.from('players')
      .insert({ room_id: rid, name: name.trim(), line, role })
      .select().single()
    if (pErr || !player) { setError('Error al unirse. Intenta de nuevo.'); setLoading(false); return }
    saveSession({ roomId: rid, playerId: player.id, name: name.trim(), line, role })
    window.location.href = '/play'
  }

  async function handleDocente(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Escribe tu nombre'); return }
    setLoading(true)
    const rid = roomId.trim().toUpperCase()
    await ensureRoom(rid)
    const { data: player } = await supabase.from('players')
      .insert({ room_id: rid, name: name.trim(), line: 'A', role: 'Docente' })
      .select().single()
    if (player) {
      saveSession({ roomId: rid, playerId: player.id, name: name.trim(), line: 'A', role: 'Docente' })
      window.location.href = '/docente'
    }
    setLoading(false)
  }

  async function handleCliente(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Escribe tu nombre'); return }
    setLoading(true)
    const rid = roomId.trim().toUpperCase()
    await ensureRoom(rid)
    const { data: player } = await supabase.from('players')
      .insert({ room_id: rid, name: name.trim(), line, role: 'Cliente' })
      .select().single()
    if (player) {
      saveSession({ roomId: rid, playerId: player.id, name: name.trim(), line, role: 'Cliente' })
      window.location.href = '/cliente'
    }
    setLoading(false)
  }

  return (
    <main className="hero">
      <div className="card hero-card">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span className="badge">Production Line Live</span>
          <h1 style={{ marginTop: 12 }}>Fábrica Inteligente</h1>
          <p>Simulación de línea de producción en tiempo real</p>
        </div>

        {error && <div className="alert alert-danger mb-12">{error}</div>}

        <form className="grid" onSubmit={handleJoin}>
          <label>
            Código de sala
            <input value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="Ej. OPEN2026" />
          </label>
          <label>
            Tu nombre
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Ana García" />
          </label>
          <label>
            Línea
            <select value={line} onChange={e => setLine(e.target.value as Line)}>
              <option value="A">Línea A</option>
              <option value="B">Línea B</option>
            </select>
          </label>
          <label>
            Tu rol
            <select value={role} onChange={e => setRole(e.target.value as Role)}>
              {COMPANY_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-full" disabled={loading}>
            {loading ? 'Conectando...' : '🏭 Unirme a la empresa'}
          </button>
          <div className="grid-2" style={{ gap: 8 }}>
            <button type="button" className="btn-light btn-full" disabled={loading} onClick={handleCliente}>
              🛒 Cliente
            </button>
            <button type="button" className="btn-dark btn-full" disabled={loading} onClick={handleDocente}>
              🎓 Docente
            </button>
          </div>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <a href="/empresa" style={{ fontSize: 13, color: '#2563eb' }}>📺 Ver pantalla empresa →</a>
        </div>
      </div>
    </main>
  )
}
