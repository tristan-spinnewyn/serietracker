import { PROVIDERS } from '@/lib/constants';

const logoStyle = (p: { bg: string }, size: number): React.CSSProperties => ({
  width: size, height: size, borderRadius: 5,
  background: p.bg, color: 'white',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: Math.round(size * 0.48), fontWeight: 700, letterSpacing: '-0.02em',
  boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 2px 6px rgba(0,0,0,0.3)',
  fontFamily: 'Inter, sans-serif', flexShrink: 0,
});

export function ProviderLogo({ id, size = 22, title, href }: { id: string; size?: number; title?: string; href?: string }) {
  const p = PROVIDERS[id];
  if (!p) return null;

  const inner = (
    <div title={title || p.name} style={logoStyle(p, size)}>
      {id === 'appletv' ? (
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="white" aria-hidden="true">
          <path d="M16.5 2c0 1.4-.5 2.6-1.4 3.5-1 1-2.2 1.6-3.4 1.5-.1-1.3.4-2.7 1.4-3.6.5-.5 1.1-.9 1.8-1.1.6-.2 1.1-.3 1.6-.3zm3 14.8c-.5 1.2-.8 1.7-1.5 2.7-.9 1.3-2.3 3-3.9 3-1.5 0-1.9-1-3.9-1-2 0-2.5 1-3.9 1-1.7 0-3-1.5-3.9-2.9-2.6-3.7-2.9-8-1.3-10.4 1.1-1.6 2.9-2.6 4.6-2.6 1.7 0 2.8.9 4.2.9 1.4 0 2.2-.9 4.2-.9 1.5 0 3.1.8 4.2 2.2-3.7 2-3.1 7.4.2 8z"/>
        </svg>
      ) : p.mono}
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', textDecoration: 'none' }}>
        {inner}
      </a>
    );
  }
  return inner;
}

export function ProviderRow({ ids, links = {}, size = 22, max = 4, label }: { ids: string[]; links?: Record<string, string>; size?: number; max?: number; label?: string }) {
  if (!ids?.length) return null;
  const visible = ids.slice(0, max);
  const extra = ids.length - visible.length;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {label && <span style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginRight: 6, fontWeight: 600 }}>{label}</span>}
      {visible.map(id => <ProviderLogo key={id} id={id} size={size} href={links[id]} />)}
      {extra > 0 && <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 4, fontFamily: 'JetBrains Mono, monospace' }}>+{extra}</span>}
    </div>
  );
}
