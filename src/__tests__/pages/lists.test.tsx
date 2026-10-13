// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const {
  mockApiFetch,
  mockCreateList,
  mockAddMemberToList,
  mockRemoveShowFromList,
  mockReorderList,
} = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
  mockCreateList: vi.fn(),
  mockAddMemberToList: vi.fn(),
  mockRemoveShowFromList: vi.fn(),
  mockReorderList: vi.fn(),
}));

vi.mock('@/lib/fetch', () => ({
  apiFetch: mockApiFetch,
}));

vi.mock('@/lib/actions/lists', () => ({
  createList: mockCreateList,
  addMemberToList: mockAddMemberToList,
  removeShowFromList: mockRemoveShowFromList,
  reorderList: mockReorderList,
}));

// Mock @dnd-kit/core and @dnd-kit/sortable to keep testing simple and deterministic
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: any) => (
    <div>
      <button data-testid="simulate-drag" onClick={() => onDragEnd?.({ active: { id: 's1' }, over: { id: 's2' } })}>Drag</button>
      {children}
    </div>
  ),
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  arrayMove: (array: any[], from: number, to: number) => {
    const copy = [...array];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  },
}));

import ListsPage from '@/app/(app)/lists/page';

describe('ListsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockListsData = [
    {
      id: 'l1',
      name: 'À voir en couple',
      emoji: '🍿',
      color: '#A855F7',
      members: [
        { user: { id: 'u1', name: 'Léa', color: '#A855F7', initials: 'L' } },
        { user: { id: 'u2', name: 'Thomas', color: '#34D399', initials: 'T' } },
      ],
      items: [
        {
          id: 'item-1',
          show: {
            id: 's1',
            title: 'Severance',
            type: 'SERIES' as const,
            year: 2022,
            network: 'Apple TV+',
            tmdbId: 100,
            anilistId: null,
            posterPath: '/severance.jpg',
          },
          addedBy: { name: 'Léa', color: '#A855F7', initials: 'L' },
        },
        {
          id: 'item-2',
          show: {
            id: 's2',
            title: 'Shogun',
            type: 'SERIES' as const,
            year: 2024,
            network: 'FX',
            tmdbId: 200,
            anilistId: null,
            posterPath: '/shogun.jpg',
          },
          addedBy: { name: 'Thomas', color: '#34D399', initials: 'T' },
        },
      ],
    },
    {
      id: 'l2',
      name: 'Animes du moment',
      emoji: '🌸',
      color: '#FB7185',
      members: [
        { user: { id: 'u1', name: 'Léa', color: '#A855F7', initials: 'L' } },
      ],
      items: [],
    },
  ];

  it('affiche un état vide lorsqu\'il n\'y a aucune liste', async () => {
    mockApiFetch.mockResolvedValue({ lists: [] });

    render(<ListsPage />);

    await waitFor(() => {
      expect(screen.getByText('Aucune liste')).toBeDefined();
      expect(screen.getByText('Crée ta première liste pour organiser tes shows.')).toBeDefined();
    });
  });

  it('affiche les listes dans le rail et la liste active', async () => {
    mockApiFetch.mockResolvedValue({ lists: mockListsData });

    render(<ListsPage />);

    await waitFor(() => {
      expect(screen.getByText('À voir en couple')).toBeDefined();
      expect(screen.getByText('Animes du moment')).toBeDefined();
      expect(screen.getByText('Severance')).toBeDefined();
      expect(screen.getByText('Shogun')).toBeDefined();
    });

    // Basculer sur la deuxième liste
    const animeRailBtn = screen.getByRole('button', { name: /Animes du moment/i });
    fireEvent.click(animeRailBtn);

    await waitFor(() => {
      expect(screen.getByText(/Liste vide — ajoute des shows/i)).toBeDefined();
    });
  });

  it('permet de créer une nouvelle liste via la modale', async () => {
    mockApiFetch.mockResolvedValueOnce({ lists: mockListsData });
    mockCreateList.mockResolvedValue({ id: 'l3' });
    mockApiFetch.mockResolvedValueOnce({
      lists: [
        ...mockListsData,
        {
          id: 'l3',
          name: 'Nouveautés 2025',
          emoji: '🔥',
          color: '#F97316',
          members: [],
          items: [],
        },
      ],
    });

    render(<ListsPage />);

    await waitFor(() => {
      expect(screen.getByText('À voir en couple')).toBeDefined();
    });

    // Clic sur Nouvelle liste
    const newBtn = screen.getAllByRole('button', { name: /Nouvelle liste/i })[0];
    fireEvent.click(newBtn);

    expect(screen.getByText('Icône')).toBeDefined();

    const nameInput = screen.getByPlaceholderText('Ex : À regarder cet été');
    fireEvent.change(nameInput, { target: { value: 'Nouveautés 2025' } });

    // Sélection emoji
    const emojiBtn = screen.getByRole('button', { name: '🔥' });
    fireEvent.click(emojiBtn);

    const submitBtn = screen.getByRole('button', { name: /Créer$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateList).toHaveBeenCalledWith({
        name: 'Nouveautés 2025',
        emoji: '🔥',
        color: expect.any(String),
      });
      expect(screen.getByText('Nouveautés 2025')).toBeDefined();
    });
  });

  it('permet de partager une liste avec un membre de la famille', async () => {
    mockApiFetch.mockResolvedValue({ lists: mockListsData });
    mockAddMemberToList.mockResolvedValue({ success: true, name: 'Alice' });

    render(<ListsPage />);

    await waitFor(() => {
      expect(screen.getByText('À voir en couple')).toBeDefined();
    });

    const shareBtn = screen.getByRole('button', { name: /Partager/i });
    fireEvent.click(shareBtn);

    expect(screen.getByText('Partager la liste')).toBeDefined();

    const emailInput = screen.getByPlaceholderText('email@exemple.com');
    fireEvent.change(emailInput, { target: { value: 'alice@example.com' } });

    const sendBtn = screen.getAllByRole('button', { name: /Partager/i }).find(b => b.getAttribute('type') === 'submit')!;
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(mockAddMemberToList).toHaveBeenCalledWith('l1', 'alice@example.com');
      expect(screen.getByText(/Alice a été ajouté·e à la liste/)).toBeDefined();
    });
  });

  it('permet de retirer un show de la liste active', async () => {
    mockApiFetch.mockResolvedValue({ lists: mockListsData });
    mockRemoveShowFromList.mockResolvedValue({ success: true });

    render(<ListsPage />);

    await waitFor(() => {
      expect(screen.getByText('Severance')).toBeDefined();
    });

    // Ouvre le menu d'un item de liste
    const moreBtns = screen.getAllByRole('button').filter(b => b.classList.contains('icon-btn'));
    expect(moreBtns.length).toBeGreaterThan(0);
    fireEvent.click(moreBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('Retirer de la liste')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Retirer de la liste'));

    await waitFor(() => {
      expect(mockRemoveShowFromList).toHaveBeenCalledWith('l1', 's1');
      expect(screen.queryByText('Severance')).toBeNull();
    });
  });

  it('permet de réordonner les éléments d\'une liste via drag and drop', async () => {
    mockApiFetch.mockResolvedValue({ lists: mockListsData });
    render(<ListsPage />);

    await waitFor(() => {
      expect(screen.getByText('Severance')).toBeDefined();
    });

    const dragBtn = screen.getByTestId('simulate-drag');
    fireEvent.click(dragBtn);

    expect(mockReorderList).toHaveBeenCalledWith('l1', ['s2', 's1']);
  });

  it('permet d\'annuler la création d\'une liste', async () => {
    mockApiFetch.mockResolvedValue({ lists: mockListsData });
    render(<ListsPage />);

    await waitFor(() => {
      expect(screen.getByText('À voir en couple')).toBeDefined();
    });

    const newBtn = screen.getAllByRole('button', { name: /Nouvelle liste/i })[0];
    fireEvent.click(newBtn);

    expect(screen.getByText('Icône')).toBeDefined();

    const cancelBtn = screen.getByRole('button', { name: 'Annuler' });
    fireEvent.click(cancelBtn);

    expect(screen.queryByText('Icône')).toBeNull();
  });
});
