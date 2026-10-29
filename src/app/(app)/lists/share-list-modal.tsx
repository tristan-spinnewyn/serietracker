'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { Icon } from '@/components/ui/icon';
import { addMemberToList } from '@/lib/actions/lists';

export function ShareModal({ listId, onClose, onShared }: { listId: string; onClose: () => void; onShared: () => void }) {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [isPending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setMsg(null);
    start(async () => {
      const res = await addMemberToList(listId, email.trim());
      if ('error' in res) {
        setMsg({ text: res.error, ok: false });
      } else {
        setMsg({ text: `${res.name} a été ajouté·e à la liste.`, ok: true });
        setEmail('');
        setTimeout(() => { onShared(); onClose(); }, 1200);
      }
    });
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,15,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line-2)', borderRadius: 16, padding: 28, width: 380, boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Partager la liste</h2>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-2)' }}>
          Entre l&apos;email d&apos;un membre de la famille pour lui donner accès.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            ref={inputRef}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@exemple.com"
            style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => (e.target.style.borderColor = 'var(--line-2)')}
            onBlur={e => (e.target.style.borderColor = 'var(--line)')}
          />

          {msg && (
            <div style={{
              padding: '8px 12px', borderRadius: 8, fontSize: 13,
              background: msg.ok ? 'rgba(52,211,153,0.12)' : 'rgba(251,113,133,0.12)',
              border: `1px solid ${msg.ok ? 'rgba(52,211,153,0.25)' : 'rgba(251,113,133,0.25)'}`,
              color: msg.ok ? '#6EE7B7' : '#FECACA',
            }}>
              {msg.ok ? '✓ ' : '✕ '}{msg.text}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn violet" disabled={!email.trim() || isPending} style={{ opacity: isPending ? 0.7 : 1 }}>
              <Icon name="share" size={14} />{isPending ? 'Envoi…' : 'Partager'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
