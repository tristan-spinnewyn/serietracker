import { db } from '@/lib/db';
import { notifyUsers, type NotificationPayload } from '@/lib/notifications/notify';
import { DAY } from '@/lib/sync/sync-schedule';
import type { AnilistPayload } from '@/lib/sync/anilist-show-sync';
import type { ShowStatus } from '@prisma/client';

// ── Notifications de changement ───────────────────────────────────────────────

export async function notifyChanges(
  showId: string,
  showTitle: string,
  prevStatus: ShowStatus,
  newStatus: ShowStatus,
  prevTotalSeasons: number,
  newTotalSeasons: number,
): Promise<void> {
  const subscribers = await db.userShow.findMany({
    where: { showId, notifyEnabled: true },
    select: { userId: true },
  });
  if (!subscribers.length) return;

  const notifs: NotificationPayload[] = [];

  if (newTotalSeasons > prevTotalSeasons) {
    const diff = newTotalSeasons - prevTotalSeasons;
    for (const { userId } of subscribers) {
      notifs.push({
        userId,
        type: 'NEW_SEASON',
        title: showTitle,
        body: diff > 1
          ? `${diff} nouvelles saisons disponibles (jusqu'à S${newTotalSeasons})`
          : `Saison ${newTotalSeasons} disponible`,
        showId,
      });
    }
  }

  const wasInactive = prevStatus === 'ENDED' || prevStatus === 'CANCELED' || prevStatus === 'IN_PRODUCTION';
  if (prevStatus !== newStatus && newStatus === 'RETURNING' && wasInactive) {
    for (const { userId } of subscribers) {
      notifs.push({
        userId,
        type: 'SHOW_RETURNING',
        title: showTitle,
        body: 'La série reprend !',
        showId,
      });
    }
  }

  await notifyUsers(notifs);
}

type SequelInfo = { anilistId: number; status: string; title: string };

export async function checkAndNotifySequels(
  showId: string,
  showTitle: string,
  parentAnilistId: number | null,
  relations: AnilistPayload['relations'],
): Promise<void> {
  const sequels: SequelInfo[] = (relations?.edges ?? [])
    .filter(e => e.relationType === 'SEQUEL' && e.node.type === 'ANIME')
    .filter(e => e.node.status === 'RELEASING' || e.node.status === 'NOT_YET_RELEASED')
    .map(e => ({
      anilistId: e.node.id,
      status: e.node.status,
      title: e.node.title.english ?? e.node.title.romaji ?? 'Suite',
    }));

  if (!sequels.length) return;

  const subscribers = await db.userShow.findMany({
    where: { showId, notifyEnabled: true },
    select: { userId: true },
  });
  if (!subscribers.length) return;

  // Map anilistId → dbId pour les suites déjà en base
  const inDb = await db.show.findMany({
    where: { anilistId: { in: sequels.map(s => s.anilistId) } },
    select: { id: true, anilistId: true },
  });
  const inDbMap = new Map(inDb.map(s => [s.anilistId, s.id]));

  let notifSent = false;

  for (const sequel of sequels) {
    let sequelDbId = inDbMap.get(sequel.anilistId) ?? null;

    // Suite pas encore en base → on l'importe
    if (!sequelDbId) {
      try {
        // Import dynamique pour éviter la dépendance circulaire (import-show → sync-show)
        const { importShowFromAnilist } = await import('@/lib/sync/import-show');
        const visited = new Set(parentAnilistId ? [parentAnilistId] : [] as number[]);
        const imported = await importShowFromAnilist(sequel.anilistId, visited);
        sequelDbId = imported.id;

        // Notif push — une seule fois par show par 30 jours
        if (!notifSent) {
          const since = new Date(Date.now() - 30 * DAY);
          const already = await db.notification.findFirst({
            where: { showId, type: 'SHOW_RETURNING', createdAt: { gte: since } },
          });
          if (!already) {
            const body = sequel.status === 'RELEASING'
              ? `Suite en cours de diffusion : ${sequel.title}`
              : `Suite annoncée : ${sequel.title}`;
            await notifyUsers(subscribers.map(({ userId }) => ({
              userId, type: 'SHOW_RETURNING' as const, title: showTitle, body, showId,
            })));
            notifSent = true;
          }
        }
      } catch {
        continue;
      }
    }

    if (!sequelDbId) continue;

    // Ajoute la suite en À regarder pour chaque abonné qui ne l'a pas encore
    for (const { userId } of subscribers) {
      await db.userShow.upsert({
        where: { userId_showId: { userId, showId: sequelDbId } },
        update: {},
        create: { userId, showId: sequelDbId, status: 'PLAN_TO_WATCH' },
      });
    }
  }
}
