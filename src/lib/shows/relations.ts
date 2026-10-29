import type { RelationType } from '@prisma/client';

/** AniList `relationType` values we keep, mapped onto our RelationType. */
export const ANILIST_RELATION_MAP: Record<string, RelationType> = {
  SEQUEL:      'SEQUEL',
  PREQUEL:     'PREQUEL',
  SIDE_STORY:  'SPINOFF',
  ALTERNATIVE: 'ALTERNATIVE',
  PARENT:      'PARENT',
  OTHER:       'RELATED',
};

const INVERSE: Record<RelationType, RelationType> = {
  SEQUEL:      'PREQUEL',
  PREQUEL:     'SEQUEL',
  PARENT:      'SPINOFF',
  SPINOFF:     'PARENT',
  ALTERNATIVE: 'ALTERNATIVE',
  RELATED:     'RELATED',
};

/** Relation seen from the other show (relations are stored in both directions). */
export function inverseRelationType(type: RelationType): RelationType {
  return INVERSE[type];
}
