'use client';

import { useState, useTransition, useEffect } from 'react';
import { Icon } from '@/components/ui/icon';
import { addShowToList } from '@/lib/actions/lists';
import { apiFetch } from '@/lib/fetch';
import type { ListOption } from './show-detail-types';

export function AddToListModal({ showId, onClose }: { showId: string; onClose: () => void }) {
  const [lists, setLists] = useState<ListOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ lists: { id: string; name: string; emoji: string; color: string; items: { show: { id: string } }[] }[] }>('/api/lists')
      .then(d => setLists((d.lists ?? []).map(l => ({
        id: l.id,
        name: l.name,
        emoji: l.emoji,
        color: l.color,
        itemCount: l.items.length,
        hasShow: l.items.some(i => i.show.id === showId),
      }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [showId]);

  const handleAdd = (listId: string) => {
    start(async () => {
      await addShowToList(listId, showId);
      setAdded(listId);
      setLists(prev => prev.map(l => l.id === listId ? { ...l, hasShow: true, itemCount: l.itemCount + 1 } : l));
    });
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,15,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line-2)', borderRadius: 16, padding: 24, width: 360, boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Ajouter à une liste</h2>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        {loading && <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '8px 0' }}>Chargement…</div>}

        {!loading && lists.length === 0 && (
          <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '8px 0', textAlign: 'center' }}>
            Aucune liste — crée-en une depuis la page <a href="/lists" style={{ color: 'var(--series)' }}>Listes</a>.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lists.map(l => (
            <button
              key={l.id}
              onClick={() => !l.hasShow && handleAdd(l.id)}
              disabled={l.hasShow || pending}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 10, cursor: l.hasShow ? 'default' : 'pointer',
                background: added === l.id ? 'rgba(52,211,153,0.1)' : 'var(--bg-2)',
                border: `1px solid ${added === l.id ? 'rgba(52,211,153,0.3)' : l.hasShow ? 'var(--line)' : 'var(--line)'}`,
                opacity: l.hasShow && added !== l.id ? 0.5 : 1,
                transition: 'background .15s, border-color .15s', textAlign: 'left',
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color, flexShrink: 0 }} />
              <span style={{ fontSize: 15, flexShrink: 0 }}>{l.emoji}</span>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: 'var(--text)' }}>{l.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>{l.itemCount}</span>
              {l.hasShow
                ? <span style={{ fontSize: 11, color: '#6EE7B7' }}>✓ Ajouté</span>
                : <Icon name="plus" size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
              }
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button className="btn" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
