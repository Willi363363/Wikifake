/**
 * The white panel every lobby screen sits on.
 *
 * Extracted so the lobby screens stop each re-declaring the same centred-card
 * layout inline. `containerStyle` keeps the small per-screen differences the
 * original had (100vh vs minHeight, padding, card width).
 */
export function LobbyCard({ children, width = 500, containerStyle, style }) {
  return (
    <div className="lobby" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh',
      backgroundColor: 'var(--bg-primary)',
      ...containerStyle,
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        maxWidth: `${width}px`,
        width: '100%',
        position: 'relative',
        ...style,
      }}>
        {children}
      </div>
    </div>
  );
}
