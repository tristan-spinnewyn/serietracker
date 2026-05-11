import { Icon } from '@/components/ui/icon';

export default function NotificationsPage() {
  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>Notifications</h1>
          <div className="sub">Centre des notifs in-app · web push activé sur ce device</div>
        </div>
      </div>
      <div className="empty">
        <Icon name="bell" size={28} />
        <h3>Tout est calme pour le moment</h3>
        <p>Les nouvelles saisons et épisodes du jour apparaîtront ici, et arriveront en push à 8h.</p>
      </div>
    </div>
  );
}
