import { describe, it, expect, vi } from 'vitest';

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

    const getRes = await (GET as any)();
    expect(await getRes.text()).toBe('auth GET');

    const postRes = await (POST as any)();
    expect(await postRes.text()).toBe('auth POST');
  });
});
