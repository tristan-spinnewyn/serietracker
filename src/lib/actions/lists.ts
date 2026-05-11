'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

async function getSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Non authentifié');
  return session;
}

// ── Créer une liste ──────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(100),
  emoji: z.string().max(4).default('📋'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#A855F7'),
});

export async function createList(data: { name: string; emoji?: string; color?: string }) {
  const session = await getSession();
  const { name, emoji, color } = createSchema.parse(data);

  const list = await db.sharedList.create({
    data: {
      name,
      emoji,
      color,
      createdById: session.user.id,
      members: { create: { userId: session.user.id } },
    },
  });

  revalidatePath('/lists');
  return { id: list.id };
}

// ── Ajouter un show à une liste ──────────────────────────────────────────────

export async function addShowToList(listId: string, showId: string) {
  const session = await getSession();

  // Vérifier que l'user est membre
  const member = await db.listMember.findUnique({
    where: { listId_userId: { listId, userId: session.user.id } },
  });
  if (!member) throw new Error('Accès refusé');

  const count = await db.listItem.count({ where: { listId } });

  await db.listItem.upsert({
    where: { listId_showId: { listId, showId } },
    update: {},
    create: { listId, showId, addedById: session.user.id, position: count },
  });

  revalidatePath('/lists');
}

// ── Retirer un show d'une liste ──────────────────────────────────────────────

export async function removeShowFromList(listId: string, showId: string) {
  const session = await getSession();

  const member = await db.listMember.findUnique({
    where: { listId_userId: { listId, userId: session.user.id } },
  });
  if (!member) throw new Error('Accès refusé');

  await db.listItem.delete({
    where: { listId_showId: { listId, showId } },
  }).catch(() => null);

  revalidatePath('/lists');
}

// ── Lier deux shows ──────────────────────────────────────────────────────────

export async function linkShows(fromId: string, toId: string, type: import('@prisma/client').RelationType) {
  await getSession();

  const inverseMap: Record<string, import('@prisma/client').RelationType> = {
    SEQUEL: 'PREQUEL', PREQUEL: 'SEQUEL', PARENT: 'SPINOFF',
    SPINOFF: 'PARENT', ALTERNATIVE: 'ALTERNATIVE', RELATED: 'RELATED',
  };

  await db.$transaction([
    db.showRelation.upsert({
      where: { fromShowId_toShowId: { fromShowId: fromId, toShowId: toId } },
      update: { type },
      create: { fromShowId: fromId, toShowId: toId, type },
    }),
    db.showRelation.upsert({
      where: { fromShowId_toShowId: { fromShowId: toId, toShowId: fromId } },
      update: { type: inverseMap[type] ?? 'RELATED' },
      create: { fromShowId: toId, toShowId: fromId, type: inverseMap[type] ?? 'RELATED' },
    }),
  ]);

  return { success: true };
}

// ── Partager une liste avec un utilisateur ───────────────────────────────────

export async function addMemberToList(listId: string, email: string) {
  const session = await getSession();

  // Vérifier que l'invitant est membre
  const isMember = await db.listMember.findUnique({
    where: { listId_userId: { listId, userId: session.user.id } },
  });
  if (!isMember) return { error: 'Accès refusé.' };

  // Trouver l'utilisateur cible
  const target = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!target) return { error: 'Aucun compte trouvé avec cet email.' };
  if (target.id === session.user.id) return { error: 'Tu es déjà membre de cette liste.' };

  // Vérifier qu'il n'est pas déjà membre
  const already = await db.listMember.findUnique({
    where: { listId_userId: { listId, userId: target.id } },
  });
  if (already) return { error: `${target.name} est déjà membre.` };

  await db.listMember.create({ data: { listId, userId: target.id } });
  revalidatePath('/lists');
  return { success: true, name: target.name };
}

// ── Réordonner les items d'une liste ────────────────────────────────────────

export async function reorderList(listId: string, orderedShowIds: string[]) {
  const session = await getSession();

  const member = await db.listMember.findUnique({
    where: { listId_userId: { listId, userId: session.user.id } },
  });
  if (!member) throw new Error('Accès refusé');

  await db.$transaction(
    orderedShowIds.map((showId, position) =>
      db.listItem.update({
        where: { listId_showId: { listId, showId } },
        data: { position },
      })
    )
  );

  revalidatePath('/lists');
}
