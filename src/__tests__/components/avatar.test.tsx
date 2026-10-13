// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Avatar } from '@/components/ui/avatar';

describe('Avatar component', () => {
  it('affiche les initiales de l’utilisateur', () => {
    const user = { id: '1', name: 'Alice', color: '#ff0000', initials: 'A' };
    render(<Avatar user={user} />);
    expect(screen.getByText('A')).toBeDefined();
  });

  it('applique les dimensions et classes personnalisées', () => {
    const user = { id: '2', name: 'Bob', color: '#00ff00', initials: 'B' };
    const { container } = render(<Avatar user={user} size={40} className="custom-class" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('custom-class');
    expect(el.style.width).toBe('40px');
    expect(el.style.height).toBe('40px');
  });
});
