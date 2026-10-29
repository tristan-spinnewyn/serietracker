import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { saveSubscription, removeSubscription } from '@/lib/services/push-subscriptions';
import { z } from 'zod';
import { isAllowedPushEndpoint } from '@/lib/notifications/push-endpoint';

const endpointSchema = z.string().url();

const subSchema = z.object({
  endpoint: endpointSchema.refine(isAllowedPushEndpoint, { message: 'Unknown push service' }),
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

  if (!(await saveSubscription(session.user.id, parsed.data))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ success: true });
}

// Se désabonner
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = unsubSchema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  await removeSubscription(session.user.id, parsed.data.endpoint);

  return NextResponse.json({ success: true });
}
