'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { paletteFor } from '@/lib/constants';
import { apiFetch } from '@/lib/fetch';
import { removeShowFromList, reorderList } from '@/lib/actions/lists';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import type { ListData } from './lists-types';
import { SortableListItem } from './sortable-list-item';
import { NewListModal } from './new-list-modal';
import { ShareModal } from './share-list-modal';

function NewListButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn violet" onClick={onClick}>
      <Icon name="plus" size={14} />Nouvelle liste
    </button>
  );
}

export default function ListsPage() {
  const [lists, setLists] = useState<ListData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [openItemMenu, setOpenItemMenu] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!openItemMenu) return;
    const close = () => setOpenItemMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openItemMenu]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !activeId) return;
    setLists(prev => prev.map(l => {
      if (l.id !== activeId) return l;
      const oldIndex = l.items.findIndex(i => i.show.id === active.id);
      const newIndex = l.items.findIndex(i => i.show.id === over.id);
      const reordered = arrayMove(l.items, oldIndex, newIndex);
      reorderList(l.id, reordered.map(i => i.show.id));
      return { ...l, items: reordered };
    }));
  };

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

  const handleRemoveShow = (listId: string, showId: string) => {
    setOpenItemMenu(null);
    setLists(prev => prev.map(l =>
      l.id === listId ? { ...l, items: l.items.filter(i => i.show.id !== showId) } : l
    ));
    removeShowFromList(listId, showId);
  };

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

  if (loading) return <div className="page"><div style={{ color: 'var(--text-3)', fontSize: 13 }}>Chargement…</div></div>;

  if (!lists.length) return (
    <div className="page">
      {showModal && <NewListModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
      <div className="page-h">
        <div><h1>Listes partagées</h1></div>
        <NewListButton onClick={() => setShowModal(true)} />
      </div>
      <div className="empty">
        <Icon name="lists" size={28} />
        <h3>Aucune liste</h3>
        <p>Crée ta première liste pour organiser tes shows.</p>
        <NewListButton onClick={() => setShowModal(true)} />
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
        <NewListButton onClick={() => setShowModal(true)} />
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
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map(i => i.show.id)} strategy={verticalListSortingStrategy}>
                  {items.map(item => (
                    <SortableListItem
                      key={item.show.id}
                      item={item}
                      openItemMenu={openItemMenu}
                      setOpenItemMenu={setOpenItemMenu}
                      onRemove={showId => list && handleRemoveShow(list.id, showId)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
