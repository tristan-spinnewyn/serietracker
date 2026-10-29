import type { RelationType } from '@prisma/client';
import { db } from '@/lib/db';
import { inverseRelationType } from '@/lib/shows/relations';

/** Links two shows, storing the relation in both directions (e.g. SEQUEL one way, PREQUEL back). */
export async function linkShowsBothWays(fromId: string, toId: string, type: RelationType): Promise<void> {
  const inverse = inverseRelationType(type);

  await db.$transaction([
    db.showRelation.upsert({
      where: { fromShowId_toShowId: { fromShowId: fromId, toShowId: toId } },
      update: { type },
      create: { fromShowId: fromId, toShowId: toId, type },
    }),
    db.showRelation.upsert({
      where: { fromShowId_toShowId: { fromShowId: toId, toShowId: fromId } },
      update: { type: inverse },
      create: { fromShowId: toId, toShowId: fromId, type: inverse },
    }),
  ]);
}
