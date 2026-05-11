'use client';

import { useState, useEffect, useTransition, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { Poster } from '@/components/ui/poster';
import { posterUrl, paletteFor } from '@/lib/constants';
import { apiFetch } from '@/lib/fetch';
import { createList, addMemberToList } from '@/lib/actions/lists';

interface ShowRef { id: string; title: string; type: 'SERIES' | 'ANIME'; year: number | null; network: string | null; tmdbId: number | null; anilistId: number | null; posterPath: string | null; }
interface ListItem { id: string; show: ShowRef; addedBy: { name: string; color: string; initials: string }; }
interface ListMember { user: { id: string; name: string; color: string; initials: string }; }
interface ListData { id: string; name: string; emoji: string; color: string; members: ListMember[]; items: ListItem[]; }

const LIST_COLORS = ['#A855F7','#FB7185','#34D399','#FBBF24','#60A5FA','#F97316','#EC4899','#14B8A6'];
const EMOJIS = ['📋','🎬','🌟','🔥','🎯','🛋️','🌸','☀️','🎮','📺','🍿','🎭'];

function NewListModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
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

function ShareModal({ listId, onClose, onShared }: { listId: string; onClose: () => void; onShared: () => void }) {
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
      if ('error' in res && res.error) {
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

export default function ListsPage() {
  const [lists, setLists] = useState<ListData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const load = () => {
    apiFetch<{ lists: ListData[] }>('/api/lists')
      .then(d => {
        setLists(d.lists ?? []);
        if (d.lists?.length && !activeId) setActiveId(d.lists[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreated = (id: string) => {
    setShowModal(false);
    setLoading(true);
    apiFetch<{ lists: ListData[] }>('/api/lists')
      .then(d => { setLists(d.lists ?? []); setActiveId(id); })
      .finally(() => setLoading(false));
  };

  const list = lists.find(l => l.id === activeId);
  const items = list?.items ?? [];
  const members = list?.members ?? [];

  const coverBg = (() => {
    const pals = items.slice(0, 3).map(i => paletteFor(i.show.title));
    if (!pals.length) return '#14141C';
    return `radial-gradient(at 20% 30%, ${pals[0][1]}88 0%, transparent 60%), radial-gradient(at 80% 70%, ${(pals[1] ?? pals[0])[1]}88 0%, transparent 60%), #0A0A0F`;
  })();

  const NewListBtn = () => (
    <button className="btn violet" onClick={() => setShowModal(true)}>
      <Icon name="plus" size={14} />Nouvelle liste
    </button>
  );

  if (loading) return <div className="page"><div style={{ color: 'var(--text-3)', fontSize: 13 }}>Chargement…</div></div>;

  if (!lists.length) return (
    <div className="page">
      {showModal && <NewListModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
      <div className="page-h">
        <div><h1>Listes partagées</h1></div>
        <NewListBtn />
      </div>
      <div className="empty">
        <Icon name="lists" size={28} />
        <h3>Aucune liste</h3>
        <p>Crée ta première liste pour organiser tes shows.</p>
        <NewListBtn />
      </div>
    </div>
  );

  return (
    <div className="page">
      {showModal && <NewListModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
      {showShare && list && (
        <ShareModal
          listId={list.id}
          onClose={() => setShowShare(false)}
          onShared={() => {
            setLoading(true);
            apiFetch<{ lists: ListData[] }>('/api/lists')
              .then(d => { setLists(d.lists ?? []); })
              .finally(() => setLoading(false));
          }}
        />
      )}
      <div className="page-h">
        <div><h1>Listes partagées</h1><div className="sub">Construites à plusieurs.</div></div>
        <NewListBtn />
      </div>

      <div className="lists-layout">
        <div className="list-rail">
          <div className="rail-h">Tes listes</div>
          {lists.map(l => (
            <button key={l.id} className={`rail-item ${l.id === activeId ? 'on' : ''}`} onClick={() => setActiveId(l.id)}>
              <span style={{ fontSize: 14 }}>{l.emoji}</span>
              <span>{l.name}</span>
              <span className="ct">{l.items.length}</span>
            </button>
          ))}
          <button className="rail-item" style={{ color: 'var(--text-3)' }} onClick={() => setShowModal(true)}>
            <Icon name="plus" size={14} /><span>Nouvelle liste…</span>
          </button>
        </div>

        {list && (
          <div className="list-detail">
            <div className="list-cover">
              <div style={{ position: 'absolute', inset: 0, background: coverBg, filter: 'blur(2px)' }} />
              <div className="veil" />
              <div className="h">
                <h2>{list.emoji} {list.name}</h2>
                <div className="meta">
                  <div className="av-stack">
                    {members.map(m => (
                      <div key={m.user.id} className="avatar av" style={{ width: 22, height: 22, borderRadius: '50%', fontSize: 9, background: `linear-gradient(135deg, ${m.user.color}, ${m.user.color}99)`, borderColor: 'var(--bg-1)' }}>
                        {m.user.initials}
                      </div>
                    ))}
                  </div>
                  <span>{members.length} membre{members.length > 1 ? 's' : ''} · {items.length} show{items.length > 1 ? 's' : ''}</span>
                  <button
                    onClick={() => setShowShare(true)}
                    style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', transition: 'background .15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                  >
                    <Icon name="share" size={12} /> Partager
                  </button>
                </div>
              </div>
            </div>

            <div className="list-body">
              {items.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                  Liste vide — ajoute des shows depuis la <Link href="/search" style={{ color: 'var(--series)' }}>recherche</Link>.
                </div>
              )}
              {items.map(item => (
                <Link key={item.id} href={`/show/${item.show.id}`} className="list-item" style={{ textDecoration: 'none' }}>
                  <span className="drag"><Icon name="grip" size={16} /></span>
                  <div className="li-poster">
                    <Poster title={item.show.title} type={item.show.type} imageUrl={posterUrl(item.show)} showTitle={false} showType={false} style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div>
                    <div className="t">{item.show.title}</div>
                    <div className="meta">
                      <span className={`pill ${item.show.type === 'SERIES' ? 'series' : 'anime'}`}>{item.show.type === 'SERIES' ? 'Série' : 'Anime'}</span>
                      <span>{item.show.year ?? '—'}{item.show.network ? ` · ${item.show.network}` : ''}</span>
                    </div>
                  </div>
                  <div className="by">
                    <div className="avatar av" style={{ width: 18, height: 18, borderRadius: '50%', fontSize: 9, background: `linear-gradient(135deg, ${item.addedBy.color}, ${item.addedBy.color}99)`, borderColor: 'transparent' }}>{item.addedBy.initials}</div>
                    <span>ajouté par {item.addedBy.name}</span>
                  </div>
                  <button className="icon-btn" onClick={e => e.preventDefault()}><Icon name="more" size={16} /></button>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
