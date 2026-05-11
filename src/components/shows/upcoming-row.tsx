'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/icon';

export interface UpcomingItem {
  showId: string;
  showTitle: string;
  type: 'SERIES' | 'ANIME';
  day: number;
  month: string;
  ep: string;
  epTitle: string;
  notify: boolean;
}

export function UpcomingRow({ item }: { item: UpcomingItem }) {
  const [notify, setNotify] = useState(item.notify);

  return (
    <div className="up-row">
      <div className="when">
        <span className="day">{item.day}</span>
        <span className="mo">{item.month}</span>
      </div>
      <div>
        <div className="t">
          {item.showTitle}
          <span style={{ color: 'var(--text-3)', fontWeight: 400, marginLeft: 6 }}>· {item.epTitle}</span>
        </div>
        <div className="ep-meta">
          <span className={`pill ${item.type === 'SERIES' ? 'series' : 'anime'}`}>
            {item.type === 'SERIES' ? 'Série' : 'Anime'}
          </span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{item.ep}</span>
        </div>
      </div>
      <button className={`bell ${notify ? 'on' : ''}`} onClick={() => setNotify(n => !n)}>
        <Icon name="bell" size={16} />
      </button>
      <button className="icon-btn"><Icon name="more" size={16} /></button>
    </div>
  );
}
