import { useBackendStore, type BackendStatus } from '../store/backendStore'

interface Props {
  status: BackendStatus
}

// Full-screen loading/error screen shown while the Python backend is starting up.
// Matches the main window's frameless style (no native title bar).
export const BackendLoadingScreen = ({ status }: Props) => {
  const { retry } = useBackendStore()
  const isError = status === 'error'

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#F9FAFB',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Frameless drag region with window controls */}
      <div style={{
        height: 32, flexShrink: 0,
        // @ts-ignore
        WebkitAppRegion: 'drag',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.3px', pointerEvents: 'none' }}>
          Dotty Pet
        </span>
        <button
          onClick={() => window.electron?.close?.()}
          style={{
            // @ts-ignore
            WebkitAppRegion: 'no-drag',
            position: 'absolute', right: 0, top: 0,
            width: 46, height: 32, border: 'none', background: 'transparent',
            cursor: 'pointer', color: '#9CA3AF', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#e81123'; e.currentTarget.style.color = 'white' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF' }}
        >
          &#x2715;
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        // @ts-ignore
        WebkitAppRegion: 'no-drag',
      }}>
        {isError ? (
          <>
            <span style={{ fontSize: 40 }}>⚠️</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              Backend failed to start
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
              The Python backend did not respond within 15 seconds.
              Make sure the virtual environment is set up, then retry or restart the app.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={retry}
                style={{
                  height: 36, padding: '0 20px', borderRadius: 8,
                  border: '1px solid #D1D5DB', background: '#fff', color: '#374151',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Retry
              </button>
              <button
                onClick={() => window.electron?.close?.()}
                style={{
                  height: 36, padding: '0 20px', borderRadius: 8,
                  border: 'none', background: '#1F2937', color: '#fff',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <Spinner />
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              Starting up…
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>
              Waiting for backend to be ready
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Simple CSS spinner — no external dependencies
const Spinner = () => (
  <div style={{
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid #E5E7EB',
    borderTopColor: '#6B7280',
    animation: 'spin 0.8s linear infinite',
  }}>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
)
