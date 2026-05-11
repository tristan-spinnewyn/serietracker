export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `
        radial-gradient(900px 600px at 80% -10%, rgba(168,85,247,0.1), transparent 60%),
        radial-gradient(700px 500px at -10% 110%, rgba(251,113,133,0.07), transparent 60%),
        #0A0A0F
      `,
    }}>
      {children}
    </div>
  );
}
