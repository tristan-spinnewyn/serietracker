import type { User } from '@/types';

interface AvatarProps {
  user: User;
  size?: number;
  className?: string;
}

export function Avatar({ user, size = 28, className = '' }: AvatarProps) {
  const fontSize = Math.round(size * 0.4);
  return (
    <div
      className={`avatar ${className}`}
      style={{
        width: size,
        height: size,
        fontSize,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${user.color}, ${user.color}99)`,
        borderColor: 'transparent',
      }}
    >
      {user.initials}
    </div>
  );
}
