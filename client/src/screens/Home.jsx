import { useState } from 'react';

export default function Home({ onJoin, error }) {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [creating, setCreating] = useState(false);

  async function createRoom() {
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch('/api/room/new');
    const { roomId } = await res.json();
    onJoin(roomId, name.trim());
    setCreating(false);
  }

  function joinRoom() {
    if (!name.trim() || !roomId.trim()) return;
    onJoin(roomId.trim().toUpperCase(), name.trim());
  }

  return (
    <div className="screen">
      <h1 className="logo">THE GANG</h1>
      <p className="subtitle">Jeu de cartes coopératif</p>

      <div className="card-box">
        <label style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Ton pseudo
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex: Scarface"
          maxLength={20}
          onKeyDown={e => e.key === 'Enter' && createRoom()}
        />

        <button className="btn btn-primary" onClick={createRoom} disabled={!name.trim() || creating}>
          {creating ? 'Création...' : 'Créer une salle'}
        </button>

        <div className="divider">ou rejoindre</div>

        <input
          value={roomId}
          onChange={e => setRoomId(e.target.value.toUpperCase())}
          placeholder="Code de salle (ex: A3F8C2)"
          maxLength={6}
          onKeyDown={e => e.key === 'Enter' && joinRoom()}
        />
        <button className="btn btn-secondary" onClick={joinRoom} disabled={!name.trim() || !roomId.trim()}>
          Rejoindre
        </button>

        {error && <p className="error-msg">{error}</p>}
      </div>

      <p style={{ marginTop: 24, color: 'var(--muted)', fontSize: '0.8rem', maxWidth: 360, textAlign: 'center' }}>
        2–5 joueurs · Jouez toutes les cartes (1→40) dans l'ordre croissant sans vous montrer vos cartes
      </p>
    </div>
  );
}
