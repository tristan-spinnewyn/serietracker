'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { Icon } from '@/components/ui/icon';
import { createList } from '@/lib/actions/lists';

const LIST_COLORS = ['#A855F7','#FB7185','#34D399','#FBBF24','#60A5FA','#F97316','#EC4899','#14B8A6'];
const EMOJIS = ['📋','🎬','🌟','🔥','🎯','🛋️','🌸','☀️','🎮','📺','🍿','🎭'];

export function NewListModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📋');
  const [color, setColor] = useState('#A855F7');
  const [isPending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    start(async () => {
      const res = await createList({ name: name.trim(), emoji, color });
      if (res.id) onCreated(res.id);
    });
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,15,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line-2)', borderRadius: 16, padding: 28, width: 400, boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Nouvelle liste</h2>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Nom */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Nom</label>
            <input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex : À regarder cet été"
              maxLength={60}
              style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => (e.target.style.borderColor = 'var(--line-2)')}
              onBlur={e => (e.target.style.borderColor = 'var(--line)')}
            />
          </div>

          {/* Emoji */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 8 }}>Icône</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {EMOJIS.map(e => (
                <button
                  key={e} type="button" onClick={() => setEmoji(e)}
                  style={{ width: 36, height: 36, borderRadius: 8, fontSize: 18, background: emoji === e ? 'var(--bg-3)' : 'var(--bg-2)', border: `1px solid ${emoji === e ? 'var(--line-2)' : 'var(--line)'}`, cursor: 'pointer', transition: 'all .15s' }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Couleur */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 8 }}>Couleur</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {LIST_COLORS.map(c => (
                <button
                  key={c} type="button" onClick={() => setColor(c)}
                  style={{ width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '2px solid white' : '2px solid transparent', boxShadow: color === c ? `0 0 0 2px ${c}` : 'none', transition: 'box-shadow .15s' }}
                />
              ))}
            </div>
          </div>

          {/* Aperçu + boutons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--line)' }}>
            <div className="list-dot" style={{ background: color, width: 10, height: 10, borderRadius: 3 }} />
            <span style={{ fontSize: 15 }}>{emoji}</span>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: name ? 'var(--text)' : 'var(--text-3)' }}>{name || 'Aperçu'}</span>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn violet" disabled={!name.trim() || isPending} style={{ opacity: isPending ? 0.7 : 1 }}>
              <Icon name="plus" size={14} />{isPending ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
