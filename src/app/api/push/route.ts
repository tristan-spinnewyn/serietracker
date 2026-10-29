import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

const endpointSchema = z.string().url();

const subSchema = z.object({
  endpoint: endpointSchema,
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

const unsubSchema = z.object({ endpoint: endpointSchema });

async function readJson(req: NextRequest): Promise<unknown> {
  return req.json().catch(() => null);
}

// S'abonner aux push
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = subSchema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const { endpoint, keys } = parsed.data;

  // Never let a user overwrite the keys of a subscription owned by someone else
  const existing = await db.pushSubscription.findUnique({
    where: { endpoint },
    select: { userId: true },
  });
  if (existing && existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh: keys.p256dh, auth: keys.auth },
    create: {
      userId: session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  });

  return NextResponse.json({ success: true });
}

// Se désabonner
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = unsubSchema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  await db.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
