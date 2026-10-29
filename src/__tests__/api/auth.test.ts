import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  handlers: {
    GET: vi.fn().mockReturnValue(new Response('auth GET')),
    POST: vi.fn().mockReturnValue(new Response('auth POST')),
  },
}));

import { GET, POST } from '@/app/api/auth/[...nextauth]/route';

describe('API [...nextauth]', () => {
  it('exporte les handlers GET et POST de NextAuth', async () => {
    expect(GET).toBeDefined();
    expect(POST).toBeDefined();

    const getRes = await GET(new NextRequest('http://localhost/api/auth/session'));
    expect(await getRes.text()).toBe('auth GET');

    const postRes = await POST(new NextRequest('http://localhost/api/auth/signout', { method: 'POST' }));
    expect(await postRes.text()).toBe('auth POST');
  });
});
