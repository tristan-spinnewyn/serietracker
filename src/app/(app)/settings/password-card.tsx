'use client';

import { useState, useTransition } from 'react';
import { signOut } from 'next-auth/react';
import { Icon } from '@/components/ui/icon';
import { updatePassword } from '@/lib/actions/settings';
import { Card, Field, Input, Toast } from './settings-ui';

export function PasswordCard() {
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confPw, setConfPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pwPending, startPw] = useTransition();

  const handlePassword = () => {
    setPwMsg(null);
    if (newPw !== confPw) return setPwMsg({ text: 'Les mots de passe ne correspondent pas.', ok: false });
    if (newPw.length < 8)  return setPwMsg({ text: 'Minimum 8 caractères.', ok: false });
    startPw(async () => {
      const res = await updatePassword({ current: curPw, next: newPw });
      if ('error' in res && res.error) {
        setPwMsg({ text: res.error, ok: false });
      } else {
        setPwMsg({ text: 'Mot de passe changé. Reconnexion…', ok: true });
        setCurPw(''); setNewPw(''); setConfPw('');
        // The change revoked every session, this one included
        await signOut({ callbackUrl: '/login?passwordChanged=1' });
      }
    });
  };

  return (
    <Card title="Mot de passe">
      <Field label="Mot de passe actuel">
        <Input type="password" value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
      </Field>
      <Field label="Nouveau mot de passe">
        <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="8 caractères minimum" autoComplete="new-password" />
      </Field>
      <Field label="Confirmer le nouveau mot de passe">
        <Input type="password" value={confPw} onChange={e => setConfPw(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
      </Field>

      {pwMsg && <Toast msg={pwMsg.text} ok={pwMsg.ok} />}
      <button
        className="btn" onClick={handlePassword} disabled={pwPending || !curPw || !newPw || !confPw}
        style={{ marginTop: 4, opacity: pwPending ? 0.7 : 1 }}
      >
        <Icon name="settings" size={14} />
        {pwPending ? 'Modification…' : 'Changer le mot de passe'}
      </button>
    </Card>
  );
}
