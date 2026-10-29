'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { Poster } from '@/components/ui/poster';
import { posterUrl } from '@/lib/constants';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ListItem } from './lists-types';

export function SortableListItem({ item, onRemove, openItemMenu, setOpenItemMenu }: {
  item: ListItem;
  onRemove: (showId: string) => void;
  openItemMenu: string | null;
  setOpenItemMenu: (id: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.show.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : 'auto' as const };

  return (
    <div ref={setNodeRef} style={style} className="list-item" {...attributes}>
      <span className="drag" {...listeners} style={{ cursor: 'grab', touchAction: 'none' }}>
        <Icon name="grip" size={16} />
      </span>
      <Link href={`/show/${item.show.id}`} className="li-poster" style={{ textDecoration: 'none', display: 'block' }}>
        <Poster title={item.show.title} type={item.show.type} imageUrl={posterUrl(item.show)} showTitle={false} showType={false} style={{ width: '100%', height: '100%' }} />
      </Link>
      <Link href={`/show/${item.show.id}`} style={{ textDecoration: 'none', flex: 1, minWidth: 0 }}>
        <div className="t">{item.show.title}</div>
        <div className="meta">
          <span className={`pill ${item.show.type === 'SERIES' ? 'series' : 'anime'}`}>{item.show.type === 'SERIES' ? 'Série' : 'Anime'}</span>
          <span>{item.show.year ?? '—'}{item.show.network ? ` · ${item.show.network}` : ''}</span>
        </div>
      </Link>
      <div className="by">
        <div className="avatar av" style={{ width: 18, height: 18, borderRadius: '50%', fontSize: 9, background: `linear-gradient(135deg, ${item.addedBy.color}, ${item.addedBy.color}99)`, borderColor: 'transparent' }}>{item.addedBy.initials}</div>
        <span>ajouté par {item.addedBy.name}</span>
      </div>
      <div style={{ position: 'relative' }}>
        <button
          className="icon-btn"
          onClick={e => { e.stopPropagation(); setOpenItemMenu(openItemMenu === item.show.id ? null : item.show.id); }}
        >
          <Icon name="more" size={16} />
        </button>
        {openItemMenu === item.show.id && (
          <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 20, background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 8, padding: 4, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
            <button
              onClick={() => onRemove(item.show.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, background: 'transparent', border: 'none', color: '#FECACA', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(251,113,133,0.1)')}
              onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
            >
              <Icon name="x" size={13} />Retirer de la liste
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
