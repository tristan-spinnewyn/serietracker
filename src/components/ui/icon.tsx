import React from 'react';

type IconName =
  | 'home' | 'calendar' | 'search' | 'lists' | 'user'
  | 'bell' | 'settings' | 'play' | 'plus' | 'check'
  | 'chevR' | 'chevL' | 'chevD' | 'chevU' | 'more'
  | 'grip' | 'filter' | 'star' | 'share' | 'sparkle'
  | 'eye' | 'x' | 'binge';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const paths: Record<IconName, React.ReactNode> = {
  home:     <><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>,
  search:   <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  lists:    <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></>,
  user:     <><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></>,
  bell:     <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
  play:     <path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none"/>,
  plus:     <path d="M12 5v14M5 12h14"/>,
  check:    <path d="M5 12l5 5L20 7"/>,
  chevR:    <path d="m9 6 6 6-6 6"/>,
  chevL:    <path d="m15 6-6 6 6 6"/>,
  chevD:    <path d="m6 9 6 6 6-6"/>,
  chevU:    <path d="m6 15 6-6 6 6"/>,
  more:     <><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></>,
  grip:     <><circle cx="9" cy="6" r="1.3" fill="currentColor"/><circle cx="15" cy="6" r="1.3" fill="currentColor"/><circle cx="9" cy="12" r="1.3" fill="currentColor"/><circle cx="15" cy="12" r="1.3" fill="currentColor"/><circle cx="9" cy="18" r="1.3" fill="currentColor"/><circle cx="15" cy="18" r="1.3" fill="currentColor"/></>,
  filter:   <path d="M3 5h18l-7 9v6l-4-2v-4z"/>,
  star:     <path d="m12 3 2.9 6 6.6.6-5 4.5 1.5 6.4L12 17l-6 3.5L7.5 14 2.5 9.6 9.1 9z" fill="currentColor" stroke="none"/>,
  share:    <><circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="m9 11 6-4M9 13l6 4"/></>,
  sparkle:  <path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>,
  eye:      <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
  x:        <path d="M18 6L6 18M6 6l12 12"/>,
  binge:    <><path d="M5 3l14 9-14 9V3z" fill="currentColor" stroke="none"/><path d="M19 9h2M19 15h2"/></>,
};

export function Icon({ name, size = 18, className, style }: IconProps) {
  return (
    <svg
      className={`ic${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
