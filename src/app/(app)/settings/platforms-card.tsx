'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/ui/icon';
import { PROVIDERS } from '@/lib/constants';
import { updatePlatforms } from '@/lib/actions/settings';
import { Card, Toast } from './settings-ui';

export function PlatformsCard({ initialPlatforms }: { initialPlatforms: string[] }) {
  const [platforms, setPlatforms] = useState<string[]>(initialPlatforms);
  const [platMsg, setPlatMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [platPending, startPlat] = useTransition();

  const togglePlatform = (id: string) =>
    setPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const handlePlatforms = () => {
    setPlatMsg(null);
    startPlat(async () => {
      await updatePlatforms(platforms);
      setPlatMsg({ text: 'Plateformes sauvegardées.', ok: true });
    });
  };

  return (
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
  );
}
