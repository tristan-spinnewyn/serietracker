import { Card } from './settings-ui';

const STATUS_LABELS: Record<string, string> = {
  WATCHING:      'En cours',
  COMPLETED:     'Terminés',
  PLAN_TO_WATCH: 'À regarder',
  PAUSED:        'En pause',
  DROPPED:       'Abandonnés',
};

const STATUS_COLORS: Record<string, string> = {
  WATCHING:      'var(--violet)',
  COMPLETED:     'var(--green)',
  PLAN_TO_WATCH: '#60A5FA',
  PAUSED:        '#FBBF24',
  DROPPED:       '#FB7185',
};

function formatDuration(minutes: number): string {
  if (minutes === 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (h < 100 && m > 0) return `${h}h ${m}min`;
  return `${h}h`;
}

export interface Stats {
  totalEpisodes: number;
  totalMinutes: number;
  showsByStatus: Record<string, number>;
  avgRating: number | null;
  topGenres: { genre: string; count: number }[];
  memberSince: string;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 10,
      padding: '14px 12px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5, fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

export function StatsCard({ stats }: { stats: Stats }) {
  const memberYear = new Date(stats.memberSince).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const maxGenreCount = stats.topGenres[0]?.count ?? 1;

  return (
    <Card title="Statistiques">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        <StatTile label="Épisodes vus" value={stats.totalEpisodes.toLocaleString('fr-FR')} />
        <StatTile label="Temps de visionnage" value={formatDuration(stats.totalMinutes)} />
        <StatTile label="Note moyenne" value={stats.avgRating != null ? `★ ${stats.avgRating.toFixed(1)}` : '—'} />
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500, marginBottom: 8 }}>Statuts</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {Object.entries(STATUS_LABELS).map(([status, label]) => {
          const count = stats.showsByStatus[status] ?? 0;
          if (count === 0) return null;
          return (
            <div key={status} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 20,
              background: 'var(--bg-2)', border: '1px solid var(--line)',
              fontSize: 12,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLORS[status], flexShrink: 0 }} />
              <span style={{ color: 'var(--text-2)' }}>{label}</span>
              <span style={{ color: 'var(--text)', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{count}</span>
            </div>
          );
        })}
      </div>

      {stats.topGenres.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500, marginBottom: 10 }}>Top genres</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.topGenres.map(({ genre, count }) => (
              <div key={genre} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 88, fontSize: 12, color: 'var(--text-2)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {genre}
                </div>
                <div style={{ flex: 1, height: 5, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    background: 'var(--violet)',
                    width: `${(count / maxGenreCount) * 100}%`,
                  }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace', width: 22, textAlign: 'right', flexShrink: 0 }}>
                  {count}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 20, fontSize: 12, color: 'var(--text-3)' }}>
        Membre depuis {memberYear}
      </div>
    </Card>
  );
}
