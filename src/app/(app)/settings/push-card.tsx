'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/icon';
import { Card } from './settings-ui';

// VAPID keys are URL-safe base64; the Push API wants raw bytes
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

type PushState = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed';

// Push support and subscription status of this browser
async function detectPushState(): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return (await reg.pushManager.getSubscription()) ? 'subscribed' : 'unsubscribed';
  } catch {
    return 'unsupported';
  }
}

export function PushCard({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [pushState, setPushState] = useState<PushState>('loading');
  const [pushPending, setPushPending] = useState(false);

  useEffect(() => {
    let active = true;
    detectPushState().then(state => { if (active) setPushState(state); });
    return () => { active = false; };
  }, []);

  const handlePushToggle = async () => {
    setPushPending(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      if (pushState === 'subscribed') {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
          await sub.unsubscribe();
        }
        setPushState('unsubscribed');
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') { setPushState('denied'); return; }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        const json = sub.toJSON();
        await fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        });
        setPushState('subscribed');
      }
    } catch {
      // permission refusée ou erreur SW
    } finally {
      setPushPending(false);
    }
  };

  return (
    <Card title="Notifications">
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-2)' }}>
        Reçois une notification push à 8h pour les nouveaux épisodes de tes shows.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--line)' }}>
        <Icon name="bell" size={18} style={{ color: pushState === 'subscribed' ? 'var(--violet)' : 'var(--text-3)', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 500 }}>Notifications push</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {pushState === 'loading'      && 'Vérification…'}
            {pushState === 'unsupported'  && 'Non supporté par ce navigateur'}
            {pushState === 'denied'       && 'Permission refusée — réactive-la dans les réglages du navigateur'}
            {pushState === 'subscribed'   && '● Activées sur cet appareil'}
            {pushState === 'unsubscribed' && 'Désactivées sur cet appareil'}
          </div>
        </div>
        {pushState !== 'unsupported' && pushState !== 'denied' && pushState !== 'loading' && (
          <button
            className={`btn ${pushState === 'subscribed' ? '' : 'violet'}`}
            style={{ marginLeft: 'auto', flexShrink: 0, opacity: pushPending ? 0.7 : 1 }}
            onClick={handlePushToggle}
            disabled={pushPending}
          >
            {pushPending ? '…' : pushState === 'subscribed' ? 'Désactiver' : 'Activer'}
          </button>
        )}
      </div>
    </Card>
  );
}
