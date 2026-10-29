// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const { mockRedirect, mockPush, mockRefresh, mockSignIn, mockRegisterAction, searchParamsState } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockSignIn: vi.fn(),
  mockRegisterAction: vi.fn(),
  searchParamsState: { current: new URLSearchParams() },
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => searchParamsState.current,
}));

vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: 'font-inter' }),
}));

vi.mock('next-auth/react', () => ({
  signIn: mockSignIn,
}));

vi.mock('@/lib/actions/auth', () => ({
  registerAction: mockRegisterAction,
}));

import RootPage from '@/app/page';
import RootLayout from '@/app/layout';
import AuthLayout from '@/app/(auth)/layout';
import LoginPage from '@/app/(auth)/login/page';
import RegisterPage from '@/app/(auth)/register/page';

describe('Auth & Root Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsState.current = new URLSearchParams();
  });

  describe('RootPage', () => {
    it('redirige vers /dashboard', () => {
      RootPage();
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('RootLayout', () => {
    it('rend le layout racine avec ses enfants', () => {
      render(
        <RootLayout>
          <div>Contenu Racine</div>
        </RootLayout>
      );
      expect(screen.getByText('Contenu Racine')).toBeDefined();
    });
  });

  describe('AuthLayout', () => {
    it('rend le conteneur auth avec ses enfants', () => {
      render(
        <AuthLayout>
          <div>Formulaire Auth</div>
        </AuthLayout>
      );
      expect(screen.getByText('Formulaire Auth')).toBeDefined();
    });
  });

  describe('LoginPage', () => {
    it('affiche le formulaire et gère la connexion réussie', async () => {
      mockSignIn.mockResolvedValue({ error: null });

      render(<LoginPage />);
      expect(screen.getByText('SeriesTracker')).toBeDefined();

      const emailInput = screen.getByPlaceholderText('toi@example.com');
      const passInput = screen.getByPlaceholderText('••••••••');
      const submitBtn = screen.getByRole('button', { name: /Se connecter/i });

      fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
      fireEvent.change(passInput, { target: { value: 'password123' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('credentials', {
          email: 'user@test.com',
          password: 'password123',
          redirect: false,
        });
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it.each([
      ['an internal callbackUrl', '/show/abc', '/show/abc'],
      ['an external callbackUrl', 'https://evil.com', '/dashboard'],
    ])('redirects safely after login with %s', async (_label, callbackUrl, expected) => {
      searchParamsState.current = new URLSearchParams({ callbackUrl });
      mockSignIn.mockResolvedValue({ error: null });

      render(<LoginPage />);
      fireEvent.change(screen.getByPlaceholderText('toi@example.com'), { target: { value: 'user@test.com' } });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /Se connecter/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expected);
      });
    });

    it('tells the user to wait when login attempts are rate limited', async () => {
      mockSignIn.mockResolvedValue({ error: 'CredentialsSignin', code: 'rate_limited' });

      render(<LoginPage />);
      fireEvent.change(screen.getByPlaceholderText('toi@example.com'), { target: { value: 'user@test.com' } });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /Se connecter/i }));

      await waitFor(() => {
        expect(screen.getByText('Trop de tentatives. Réessaie dans quelques minutes.')).toBeDefined();
      });
    });

    it('affiche un message d\'erreur si signIn échoue', async () => {
      mockSignIn.mockResolvedValue({ error: 'CredentialsSignin' });

      render(<LoginPage />);
      const emailInput = screen.getByPlaceholderText('toi@example.com');
      const passInput = screen.getByPlaceholderText('••••••••');
      const submitBtn = screen.getByRole('button', { name: /Se connecter/i });

      fireEvent.change(emailInput, { target: { value: 'bad@test.com' } });
      fireEvent.change(passInput, { target: { value: 'wrongpass' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Email ou mot de passe incorrect.')).toBeDefined();
      });
    });
  });

  describe('RegisterPage', () => {
    it('permet de créer un compte avec succès', async () => {
      mockRegisterAction.mockResolvedValue({ success: true });
      mockSignIn.mockResolvedValue({ error: null });

      render(<RegisterPage />);
      expect(screen.getByText('Créer un compte')).toBeDefined();

      const nameInput = screen.getByPlaceholderText('Léa');
      const emailInput = screen.getByPlaceholderText('toi@example.com');
      const passInput = screen.getByPlaceholderText('••••••••');
      const submitBtn = screen.getByRole('button', { name: /Créer le compte/i });

      fireEvent.change(nameInput, { target: { value: 'Alice' } });
      fireEvent.change(emailInput, { target: { value: 'alice@test.com' } });
      fireEvent.change(passInput, { target: { value: 'password123' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockRegisterAction).toHaveBeenCalledWith({
          name: 'Alice',
          email: 'alice@test.com',
          password: 'password123',
        });
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('affiche l\'erreur retournée par registerAction', async () => {
      mockRegisterAction.mockResolvedValue({ error: 'Cet email est déjà pris.' });

      render(<RegisterPage />);
      const nameInput = screen.getByPlaceholderText('Léa');
      const emailInput = screen.getByPlaceholderText('toi@example.com');
      const passInput = screen.getByPlaceholderText('••••••••');
      const submitBtn = screen.getByRole('button', { name: /Créer le compte/i });

      fireEvent.change(nameInput, { target: { value: 'Alice' } });
      fireEvent.change(emailInput, { target: { value: 'alice@test.com' } });
      fireEvent.change(passInput, { target: { value: 'password123' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Cet email est déjà pris.')).toBeDefined();
      });
    });
  });
});
