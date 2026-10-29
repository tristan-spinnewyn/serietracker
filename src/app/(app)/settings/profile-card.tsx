'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { updateProfile } from '@/lib/actions/settings';
import { Card, Field, Input, Toast } from './settings-ui';

const COLORS = [
  '#A855F7', '#FB7185', '#34D399', '#FBBF24',
  '#60A5FA', '#F97316', '#EC4899', '#14B8A6',
];

export function ProfileCard({ initialName, initialColor, email }: { initialName: string; initialColor: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [profileMsg, setProfileMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [profilePending, startProfile] = useTransition();

  const handleProfile = () => {
    setProfileMsg(null);
    startProfile(async () => {
      const res = await updateProfile({ name, color });
      setProfileMsg(res.success ? { text: 'Profil mis à jour.', ok: true } : { text: 'Erreur.', ok: false });
      router.refresh();
    });
  };

  const preview = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
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
        <Input value={email} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
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
  );
}
