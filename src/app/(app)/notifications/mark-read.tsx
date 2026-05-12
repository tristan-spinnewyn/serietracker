'use client';

import { useEffect } from 'react';
import { markAllNotificationsRead } from '@/lib/actions/notifications';

export function MarkReadOnMount({ hasUnread }: { hasUnread: boolean }) {
  useEffect(() => {
    if (hasUnread) markAllNotificationsRead();
  }, [hasUnread]);
  return null;
}
