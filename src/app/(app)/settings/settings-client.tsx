'use client';

import { StatsCard, type Stats } from './stats-card';
import { ProfileCard } from './profile-card';
import { PasswordCard } from './password-card';
import { PlatformsCard } from './platforms-card';
import { AnilistSyncCard } from './anilist-sync-card';
import { PushCard } from './push-card';

interface User {
  id: string; name: string; email: string;
  color: string; initials: string; platforms: string[];
}

export function SettingsClient({ user, stats, vapidPublicKey }: { user: User; stats: Stats; vapidPublicKey: string }) {
  return (
    <div className="page" style={{ maxWidth: 680 }}>
      <div className="page-h">
        <div>
          <h1>Paramètres</h1>
          <div className="sub">{user.email}</div>
        </div>
      </div>

      <StatsCard stats={stats} />
      <ProfileCard initialName={user.name} initialColor={user.color} email={user.email} />
      <PasswordCard />
      <PlatformsCard initialPlatforms={user.platforms} />
      <AnilistSyncCard />
      <PushCard vapidPublicKey={vapidPublicKey} />
    </div>
  );
}
