import { db } from '@/lib/db';

/** Shared lists the user is a member of, with members and ordered items. */
export async function getUserLists(userId: string) {
  const lists = await db.sharedList.findMany({
    where: { members: { some: { userId } } },
    select: {
      id: true,
      name: true,
      emoji: true,
      color: true,
      members: {
        select: {
          user: {
            select: { id: true, name: true, color: true, initials: true },
          },
        },
      },
      items: {
        select: {
          id: true,
          addedBy: {
            select: { name: true, color: true, initials: true },
          },
          show: {
            select: {
              id: true, title: true, type: true, year: true,
              network: true, tmdbId: true, anilistId: true, posterPath: true,
            },
          },
        },
        orderBy: { position: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return { lists };
}

export async function isListMember(listId: string, userId: string): Promise<boolean> {
  const member = await db.listMember.findUnique({
    where: { listId_userId: { listId, userId } },
  });
  return member !== null;
}

/** Adds a show at the end of a list (no-op if it is already there). */
export async function appendShowToList(listId: string, showId: string, addedById: string): Promise<void> {
  const count = await db.listItem.count({ where: { listId } });
  await db.listItem.upsert({
    where: { listId_showId: { listId, showId } },
    update: {},
    create: { listId, showId, addedById, position: count },
  });
}

export async function deleteListItem(listId: string, showId: string): Promise<void> {
  await db.listItem.delete({
    where: { listId_showId: { listId, showId } },
  }).catch(() => null); // already removed
}

/** Saves the order of a list's items, index = position. */
export async function reorderListItems(listId: string, orderedShowIds: string[]): Promise<void> {
  await db.$transaction(
    orderedShowIds.map((showId, position) =>
      db.listItem.update({
        where: { listId_showId: { listId, showId } },
        data: { position },
      })
    )
  );
}

/** Adds the account with this email to a list the inviter belongs to. */
export async function inviteToList(
  listId: string,
  inviterId: string,
  email: string,
): Promise<{ error: string } | { success: true; name: string }> {
  if (!(await isListMember(listId, inviterId))) return { error: 'Accès refusé.' };

  const target = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!target) return { error: 'Aucun compte trouvé avec cet email.' };
  if (target.id === inviterId) return { error: 'Tu es déjà membre de cette liste.' };
  if (await isListMember(listId, target.id)) return { error: `${target.name} est déjà membre.` };

  await db.listMember.create({ data: { listId, userId: target.id } });
  return { success: true, name: target.name };
}
