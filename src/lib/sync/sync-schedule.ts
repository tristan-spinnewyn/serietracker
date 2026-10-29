import type { ShowStatus } from '@prisma/client';

export const DAY = 86_400_000;

export function nextSyncMs(status: ShowStatus): number {
  switch (status) {
    case 'RETURNING':     return 1  * DAY;
    case 'UPCOMING':      return 7  * DAY;
    case 'IN_PRODUCTION': return 30 * DAY;
    case 'ENDED':
    case 'CANCELED':      return 90 * DAY;
    default:              return 30 * DAY;
  }
}
