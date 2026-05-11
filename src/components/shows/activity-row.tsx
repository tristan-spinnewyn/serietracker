import { MiniPoster } from '@/components/ui/poster';
import { posterUrl } from '@/lib/constants';

export interface ActivityEntry {
  id: string;
  userName: string;
  userColor: string;
  userInitials: string;
  verb: string;
  showTitle: string;
  showType: 'SERIES' | 'ANIME';
  showPosterUrl: string | null;
  detail: string;
  when: string;
  system?: boolean;
}

export function ActivityRow({ entry }: { entry: ActivityEntry }) {
  if (entry.system) {
    return (
      <div className="activity-row">
        <div className="avatar" style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(52,211,153,0.14)', color: '#6EE7B7', borderColor: 'rgba(52,211,153,0.3)', fontSize: 14 }}>★</div>
        <MiniPoster title={entry.showTitle} imageUrl={entry.showPosterUrl} size={40} />
        <div className="txt">
          <strong style={{ color: '#6EE7B7' }}>{entry.verb}</strong> · <em>{entry.showTitle}</em>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{entry.detail}</div>
        </div>
        <div className="time">{entry.when}</div>
      </div>
    );
  }

  return (
    <div className="activity-row">
      <div className="avatar" style={{ width: 32, height: 32, borderRadius: '50%', fontSize: 12, background: `linear-gradient(135deg, ${entry.userColor}, ${entry.userColor}99)`, borderColor: 'transparent', flexShrink: 0 }}>
        {entry.userInitials}
      </div>
      <MiniPoster title={entry.showTitle} imageUrl={entry.showPosterUrl} size={40} />
      <div className="txt">
        <strong>{entry.userName}</strong> {entry.verb} <em>{entry.showTitle}</em>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{entry.detail}</div>
      </div>
      <div className="time">{entry.when}</div>
    </div>
  );
}
