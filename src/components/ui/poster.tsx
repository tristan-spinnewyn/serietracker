import { paletteFor } from '@/lib/constants';

interface PosterProps {
  title: string;
  type: 'SERIES' | 'ANIME' | 'series' | 'anime';
  imageUrl?: string | null;
  showTitle?: boolean;
  showType?: boolean;
  style?: React.CSSProperties;
}

export function Poster({ title, type, imageUrl, showTitle = true, showType = true, style }: PosterProps) {
  const pal = paletteFor(title);
  const isAnime = type === 'ANIME' || type === 'anime';
  const bg = `
    radial-gradient(at 30% 20%, ${pal[2]}55 0%, transparent 50%),
    radial-gradient(at 70% 80%, ${pal[1]}cc 0%, transparent 60%),
    linear-gradient(150deg, ${pal[0]} 0%, ${pal[1]} 100%)
  `;

  return (
    <div className={`poster ${isAnime ? 'anime' : 'series'}`} style={style}>
      {imageUrl
        ? <img src={imageUrl} alt={title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div className="bg" style={{ background: bg }} />
      }
      <div className="grain" />
      <div className="veil" />
      {showType && <div className="type-pill">{isAnime ? 'Anime' : 'Série'}</div>}
      {showTitle && <div className="title">{title}</div>}
    </div>
  );
}

interface MiniPosterProps {
  title: string;
  imageUrl?: string | null;
  size?: number;
}

export function MiniPoster({ title, imageUrl, size = 40 }: MiniPosterProps) {
  const pal = paletteFor(title);
  return (
    <div
      className="mini-poster"
      style={{ width: Math.round(size * 0.7), height: size, borderRadius: 4, overflow: 'hidden', position: 'relative', flexShrink: 0 }}
      title={title}
    >
      {imageUrl
        ? <img src={imageUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ width: '100%', height: '100%', background: `linear-gradient(150deg, ${pal[0]}, ${pal[1]})` }} />
      }
    </div>
  );
}
