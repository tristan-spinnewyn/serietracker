import { NextRequest, NextResponse } from 'next/server';
import { runScheduledSync } from '@/lib/sync/scheduled-sync';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';

export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(await runScheduledSync());
}
