'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { PROVIDERS } from '@/lib/constants';
import { updateProfile, updatePassword, updatePlatforms } from '@/lib/actions/settings';

const COLORS = [
  '#A855F7', '#FB7185', '#34D399', '#FBBF24',
  '#60A5FA', '#F97316', '#EC4899', '#14B8A6',
];

interface User {
  id: string; name: string; email: string;
  color: string; initials: string; platforms: string[];
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 14, padding: 24, marginBottom: 20 }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 500, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%', padding: '9px 12px',
        background: 'var(--bg-2)', border: '1px solid var(--line)',
        borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none',
        transition: 'border-color .15s', boxSizing: 'border-box',
      }}
      onFocus={e => (e.target.style.borderColor = 'var(--line-2)')}
      onBlur={e => (e.target.style.borderColor = 'var(--line)')}
    />
  );
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div style={{
      padding: '8px 14px', borderRadius: 8, fontSize: 13, marginTop: 12,
      background: ok ? 'rgba(52,211,153,0.12)' : 'rgba(251,113,133,0.12)',
      border: `1px solid ${ok ? 'rgba(52,211,153,0.25)' : 'rgba(251,113,133,0.25)'}`,
      color: ok ? '#6EE7B7' : '#FECACA',
    }}>
      {ok ? '✓ ' : '✕ '}{msg}
    </div>
  );
}

export function SettingsClient({ user }: { user: User }) {
  const router = useRouter();

  // ── Profil
  const [name, setName] = useState(user.name);
  const [color, setColor] = useState(user.color);
  const [profileMsg, setProfileMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [profilePending, startProfile] = useTransition();

  // ── Mot de passe
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confPw, setConfPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pwPending, startPw] = useTransition();

  // ── Plateformes
  const [platforms, setPlatforms] = useState<string[]>(user.platforms);
  const [platMsg, setPlatMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [platPending, startPlat] = useTransition();

  const togglePlatform = (id: string) =>
    setPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const handleProfile = () => {
    setProfileMsg(null);
    startProfile(async () => {
      const res = await updateProfile({ name, color });
      setProfileMsg(res.success ? { text: 'Profil mis à jour.', ok: true } : { text: 'Erreur.', ok: false });
      router.refresh();
    });
  };

  const handlePassword = () => {
    setPwMsg(null);
    if (newPw !== confPw) return setPwMsg({ text: 'Les mots de passe ne correspondent pas.', ok: false });
    if (newPw.length < 8)  return setPwMsg({ text: 'Minimum 8 caractères.', ok: false });
    startPw(async () => {
      const res = await updatePassword({ current: curPw, next: newPw });
      if ('error' in res && res.error) {
        setPwMsg({ text: res.error, ok: false });
      } else {
        setPwMsg({ text: 'Mot de passe changé.', ok: true });
        setCurPw(''); setNewPw(''); setConfPw('');
      }
    });
  };

  const handlePlatforms = () => {
    setPlatMsg(null);
    startPlat(async () => {
      await updatePlatforms(platforms);
      setPlatMsg({ text: 'Plateformes sauvegardées.', ok: true });
    });
  };

  const preview = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div className="page" style={{ maxWidth: 680 }}>
      <div className="page-h">
        <div>
          <h1>Paramètres</h1>
          <div className="sub">{user.email}</div>
        </div>
      </div>

      {/* ── Profil ───────────────────────────────────────── */}
      <Card title="Profil">
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${color}, ${color}99)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: 'white', letterSpacing: '-0.02em',
          }}>
            {preview}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500, marginBottom: 8 }}>Couleur</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: c,
                    border: color === c ? '2px solid white' : '2px solid transparent',
                    boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                    cursor: 'pointer', transition: 'box-shadow .15s',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <Field label="Prénom / Pseudo">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ton prénom" />
        </Field>
        <Field label="Email">
          <Input value={user.email} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
        </Field>

        {profileMsg && <Toast msg={profileMsg.text} ok={profileMsg.ok} />}
        <button
          className="btn violet" onClick={handleProfile} disabled={profilePending}
          style={{ marginTop: 4, opacity: profilePending ? 0.7 : 1 }}
        >
          <Icon name="check" size={14} />
          {profilePending ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
      </Card>

      {/* ── Mot de passe ─────────────────────────────────── */}
      <Card title="Mot de passe">
        <Field label="Mot de passe actuel">
          <Input type="password" value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
        </Field>
        <Field label="Nouveau mot de passe">
          <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="8 caractères minimum" autoComplete="new-password" />
        </Field>
        <Field label="Confirmer le nouveau mot de passe">
          <Input type="password" value={confPw} onChange={e => setConfPw(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
        </Field>

        {pwMsg && <Toast msg={pwMsg.text} ok={pwMsg.ok} />}
        <button
          className="btn" onClick={handlePassword} disabled={pwPending || !curPw || !newPw || !confPw}
          style={{ marginTop: 4, opacity: pwPending ? 0.7 : 1 }}
        >
          <Icon name="settings" size={14} />
          {pwPending ? 'Modification…' : 'Changer le mot de passe'}
        </button>
      </Card>

      {/* ── Plateformes ──────────────────────────────────── */}
      <Card title="Mes plateformes">
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-2)' }}>
          Coche tes abonnements actifs — utilisés pour filtrer la recherche.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {Object.values(PROVIDERS).map(p => {
            const on = platforms.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  background: on ? 'var(--bg-3)' : 'var(--bg-2)',
                  border: `1px solid ${on ? 'var(--line-2)' : 'var(--line)'}`,
                  transition: 'background .15s, border-color .15s',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 6, background: p.bg, color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
                }}>
                  {p.id === 'appletv' ? (
                    <svg viewBox="0 0 24 24" width={16} height={16} fill="white">
                      <path d="M16.5 2c0 1.4-.5 2.6-1.4 3.5-1 1-2.2 1.6-3.4 1.5-.1-1.3.4-2.7 1.4-3.6.5-.5 1.1-.9 1.8-1.1.6-.2 1.1-.3 1.6-.3zm3 14.8c-.5 1.2-.8 1.7-1.5 2.7-.9 1.3-2.3 3-3.9 3-1.5 0-1.9-1-3.9-1-2 0-2.5 1-3.9 1-1.7 0-3-1.5-3.9-2.9-2.6-3.7-2.9-8-1.3-10.4 1.1-1.6 2.9-2.6 4.6-2.6 1.7 0 2.8.9 4.2.9 1.4 0 2.2-.9 4.2-.9 1.5 0 3.1.8 4.2 2.2-3.7 2-3.1 7.4.2 8z"/>
                    </svg>
                  ) : p.mono}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: on ? 'var(--text)' : 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                  </div>
                  {on && <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 1 }}>● Actif</div>}
                </div>
              </button>
            );
          })}
        </div>

        {platMsg && <Toast msg={platMsg.text} ok={platMsg.ok} />}
        <button
          className="btn violet" onClick={handlePlatforms} disabled={platPending}
          style={{ marginTop: 16, opacity: platPending ? 0.7 : 1 }}
        >
          <Icon name="check" size={14} />
          {platPending ? 'Sauvegarde…' : 'Sauvegarder les plateformes'}
        </button>
      </Card>

      {/* ── Notifications ────────────────────────────────── */}
      <Card title="Notifications">
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-2)' }}>
          Les notifications push web sont gérées par le navigateur. Active-les depuis la bannière d&apos;autorisation qui s&apos;affiche à la première visite.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--line)' }}>
          <Icon name="bell" size={18} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>Notifications push</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Nouveaux épisodes · 8h du matin · via VAPID natif</div>
          </div>
          <button
            className="btn"
            style={{ marginLeft: 'auto', flexShrink: 0 }}
            onClick={() => {
              if (!('Notification' in window)) return;
              Notification.requestPermission();
            }}
          >
            Activer
          </button>
        </div>
      </Card>
    </div>
  );
}
