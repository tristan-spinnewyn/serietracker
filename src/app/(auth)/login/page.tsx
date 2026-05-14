'use client';

import { Suspense, useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Icon } from '@/components/ui/icon';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError('Email ou mot de passe incorrect.');
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    background: 'var(--bg-1)', border: '1px solid var(--line)',
    borderRadius: 10, color: 'var(--text)', fontSize: 14,
    outline: 'none', transition: 'border-color .15s',
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[
        { label: 'Email', type: 'email', value: email, set: setEmail, auto: 'email', placeholder: 'toi@example.com' },
        { label: 'Mot de passe', type: 'password', value: password, set: setPassword, auto: 'current-password', placeholder: '••••••••' },
      ].map(({ label, type, value, set, auto, placeholder }) => (
        <div key={label}>
          <label style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 6 }}>
            {label}
          </label>
          <input
            type={type} value={value}
            onChange={e => set(e.target.value)}
            required autoComplete={auto} placeholder={placeholder}
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = 'var(--line-2)')}
            onBlur={e => (e.target.style.borderColor = 'var(--line)')}
          />
        </div>
      ))}

      {error && (
        <div style={{
          padding: '8px 12px', borderRadius: 8,
          background: 'rgba(251,113,133,0.12)', border: '1px solid rgba(251,113,133,0.25)',
          color: '#FECACA', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <button
        type="submit" disabled={isPending}
        className="btn violet"
        style={{ justifyContent: 'center', marginTop: 4, opacity: isPending ? 0.7 : 1 }}
      >
        {isPending ? 'Connexion…' : <><Icon name="chevR" size={14} /> Se connecter</>}
      </button>

      <div style={{ textAlign: 'center', marginTop: 4 }}>
        <Link href="/register" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
          Créer un compte →
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div style={{ width: '100%', maxWidth: 380, padding: '0 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'linear-gradient(135deg, #A855F7, #FB7185)',
          margin: '0 auto 16px',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px rgba(168,85,247,0.4)',
        }} />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
          SeriesTracker
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-3)' }}>
          Usage privé · accès restreint
        </p>
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
