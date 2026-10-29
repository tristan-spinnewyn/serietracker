'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { RelationType } from '@prisma/client';
import { requireSession } from '@/lib/session';
import { db } from '@/lib/db';
import { idSchema, idListSchema } from '@/lib/validation';
import {
  isListMember, appendShowToList, deleteListItem, reorderListItems, inviteToList,
} from '@/lib/services/shared-lists';
import { linkShowsBothWays } from '@/lib/services/show-relations';

const MAX_LIST_ITEMS = 1000;

// ── Créer une liste ──────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(100),
  emoji: z.string().max(4).default('📋'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#A855F7'),
});

export async function createList(data: { name: string; emoji?: string; color?: string }) {
  const session = await requireSession();
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
  const session = await requireSession();
  if (!(await isListMember(listId, session.user.id))) throw new Error('Accès refusé');

  await appendShowToList(listId, showId, session.user.id);
  revalidatePath('/lists');
}

// ── Retirer un show d'une liste ──────────────────────────────────────────────

export async function removeShowFromList(listId: string, showId: string) {
  const session = await requireSession();
  if (!(await isListMember(listId, session.user.id))) throw new Error('Accès refusé');

  await deleteListItem(listId, showId);
  revalidatePath('/lists');
}

// ── Lier deux shows ──────────────────────────────────────────────────────────

const linkSchema = z
  .object({ fromId: idSchema, toId: idSchema, type: z.enum(RelationType) })
  .refine(({ fromId, toId }) => fromId !== toId, { message: 'A show cannot be linked to itself' });

export async function linkShows(rawFromId: string, rawToId: string, rawType: RelationType) {
  await requireSession();
  const { fromId, toId, type } = linkSchema.parse({ fromId: rawFromId, toId: rawToId, type: rawType });

  await linkShowsBothWays(fromId, toId, type);
  return { success: true };
}

// ── Partager une liste avec un utilisateur ───────────────────────────────────

export async function addMemberToList(listId: string, email: string) {
  const session = await requireSession();
  const result = await inviteToList(listId, session.user.id, email);
  if ('success' in result) revalidatePath('/lists');
  return result;
}

// ── Réordonner les items d'une liste ────────────────────────────────────────

export async function reorderList(listId: string, rawShowIds: string[]) {
  const session = await requireSession();
  const orderedShowIds = idListSchema(MAX_LIST_ITEMS).parse(rawShowIds);
  if (!(await isListMember(listId, session.user.id))) throw new Error('Accès refusé');

  await reorderListItems(listId, orderedShowIds);
  revalidatePath('/lists');
}
