import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: '#0a0a0c', color: '#ff3b30', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, sans-serif', textAlign: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>JARVIS Başlatma Hatası</h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', maxWidth: '400px', wordBreak: 'break-word', marginBottom: '20px' }}>
            {this.state.error?.message || 'Bilinmeyen bir arayüz hatası oluştu.'}
          </p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ background: '#00f0ff', color: '#000', border: 'none', padding: '10px 24px', borderRadius: '100px', fontWeight: 600, cursor: 'pointer' }}
          >
            Yeniden Başlat
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
