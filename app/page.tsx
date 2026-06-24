'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { saveSession } from '../lib/session'
import { COMPANY_ROLES, DEMAND_SEQUENCE_T1, type Role } from '../lib/types'

export default function HomePage() {
  const [name, setName] = useState('')
  const [roomId, setRoomId] = useState('OPEN2026')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Escribe tu nombre'); return }
    setLoading(true)
    setError('')

    const rid = roomId.trim().toUpperCase()

    // Crear sala si no existe
    const { data: existing } = await supabase.from('rooms').select('id,status').eq('id', rid).single()
    if (!existing) {
      await supabase.from('rooms').insert({
        id: rid,
        status: 'waiting',
        demand_sequence: DEMAND_SEQUENCE_T1,
        demand_interval_sec: 20,
        oven_a_batch: 8,
        oven_b_batch: 4,
        oven_duration_sec: 80,
        prep_time_sec: 60,
      })
    }

    // Contar jugadores por linea y rol para asignar automaticamente
    const { data: players } = await supabase.from('players').select('line,role').eq('room_id', rid)
    const countA = (players || []).filter(p => p.line === 'A').length
    const countB = (players || []).filter(p => p.line === 'B').length

    // Asignar linea al que tenga menos jugadores
    const line = countA <= countB ? 'A' : 'B'

    // Ver roles ocupados en esa linea
    const rolesInLine = (players || []).filter(p => p.line === line).map(p => p.role)
    const availableRoles = COMPANY_ROLES.filter(r => !rolesInLine.includes(r))
    const assignedRole: Role = availableRoles.length > 0 ? availableRoles[0] : COMPANY_ROLES[0]

    // Insertar jugador
    const { data: player, error: pErr } = await supabase.from('players').insert({
      room_id: rid,
      name: name.trim(),
      line,
      role: assignedRole,
    }).select().single()

    if (pErr || !player) { setError('Error al unirse. Intenta de nuevo.'); setLoading(false); return }

    saveSession({ roomId: rid, playerId: player.id, name: name.trim(), line, role: assignedRole })
    window.location.href = '/play'
  }

  async function handleDocente(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Escribe tu nombre'); return }
    setLoading(true)
    const rid = roomId.trim().toUpperCase()

    const { data: existing } = await supabase.from('rooms').select('id').eq('id', rid).single()
    if (!existing) {
      await supabase.from('rooms').insert({
        id: rid, status: 'waiting',
        demand_sequence: DEMAND_SEQUENCE_T1,
        demand_interval_sec: 20, oven_a_batch: 8, oven_b_batch: 4,
        oven_duration_sec: 80, prep_time_sec: 60,
      })
    }

    const { data: player } = await supabase.from('players').insert({
      room_id: rid, name: name.trim(), line: 'A', role: 'Docente',
    }).select().single()

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
    const lineParam = new URLSearchParams(window.location.search).get('linea') as 'A' | 'B' || 'A'

    const { data: player } = await supabase.from('players').insert({
      room_id: rid, name: name.trim(), line: lineParam, role: 'Cliente',
    }).select().single()

    if (player) {
      saveSession({ roomId: rid, playerId: player.id, name: name.trim(), line: lineParam, role: 'Cliente' })
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

          <button type="submit" className="btn-full" disabled={loading}>
            {loading ? 'Conectando...' : '🏭 Unirme a la empresa'}
          </button>
          <button type="button" className="btn-full btn-light" disabled={loading} onClick={handleCliente}>
            🛒 Entrar como Cliente
          </button>
          <button type="button" className="btn-full btn-dark" disabled={loading} onClick={handleDocente}>
            🎓 Entrar como Docente
          </button>
        </form>

        <p className="small text-center mt-12">
          Al unirte como empresa, el sistema te asigna tu rol y línea automáticamente.
        </p>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <a href="/empresa" style={{ fontSize: 13, color: '#2563eb' }}>
            📺 Ver pantalla de la empresa →
          </a>
        </div>
      </div>
    </main>
  )
}
