// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

const {
  mockAuth,
  mockRedirect,
  mockSharedListFindMany,
  mockUserShowCount,
  mockUserFindUnique,
  mockNotificationCount,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockRedirect: vi.fn(),
  mockSharedListFindMany: vi.fn(),
  mockUserShowCount: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockNotificationCount: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard',
}));

vi.mock('@/lib/db', () => ({
  db: {
    sharedList: { findMany: mockSharedListFindMany },
    userShow: { count: mockUserShowCount },
    user: { findUnique: mockUserFindUnique },
    notification: { count: mockNotificationCount },
  },
}));

vi.mock('@/components/layout/sidebar', () => ({
  Sidebar: ({ user }: { user: { name: string } }) => <div data-testid="sidebar">Sidebar {user.name}</div>,
}));

vi.mock('@/components/layout/topbar', () => ({
  Topbar: () => <div data-testid="topbar">Topbar</div>,
}));

import AppLayout from '@/app/(app)/layout';

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirige vers /login si non authentifié', async () => {
    mockAuth.mockResolvedValue(null);
    try {
      await AppLayout({ children: <div>child</div> });
    } catch {
      // next redirect might throw or not depending on mock
    }
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('charge les données et rend la structure d\'application avec Sidebar et Topbar', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', name: 'Jean' } });
    mockSharedListFindMany.mockResolvedValue([
      { id: 'l1', name: 'Liste 1', emoji: '🎬', color: '#ff0000', _count: { items: 5 }, createdById: 'u1' },
    ]);
    mockUserShowCount.mockResolvedValue(3);
    mockUserFindUnique.mockResolvedValue({ color: '#123456', initials: 'JN' });
    mockNotificationCount.mockResolvedValue(2);

    const jsx = await AppLayout({ children: <div data-testid="page-child">Contenu Page</div> });
    render(jsx);

    expect(screen.getByTestId('sidebar')).toBeDefined();
    expect(screen.getByTestId('topbar')).toBeDefined();
    expect(screen.getByTestId('page-child')).toBeDefined();
    expect(screen.getByText('Sidebar Jean')).toBeDefined();
  });
});
