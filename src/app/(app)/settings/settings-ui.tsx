// Small presentational building blocks shared by the settings cards

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 14, padding: 24, marginBottom: 20 }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</h2>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', fontWeight: 500, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%', padding: '9px 12px',
        background: 'var(--bg-2)', border: '1px solid var(--line)',
        borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none',
        transition: 'border-color .15s', boxSizing: 'border-box',
      }}
      onFocus={e => (e.target.style.borderColor = 'var(--line-2)')}
      onBlur={e => (e.target.style.borderColor = 'var(--line)')}
    />
  );
}

export function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div style={{
      padding: '8px 14px', borderRadius: 8, fontSize: 13, marginTop: 12,
      background: ok ? 'rgba(52,211,153,0.12)' : 'rgba(251,113,133,0.12)',
      border: `1px solid ${ok ? 'rgba(52,211,153,0.25)' : 'rgba(251,113,133,0.25)'}`,
      color: ok ? '#6EE7B7' : '#FECACA',
    }}>
      {ok ? '✓ ' : '✕ '}{msg}
    </div>
  );
}
