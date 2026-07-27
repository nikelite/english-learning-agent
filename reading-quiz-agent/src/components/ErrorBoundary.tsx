import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Error in React Component Tree:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#07090e',
          color: 'white',
          fontFamily: 'sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '2.5rem',
            maxWidth: '520px',
            width: '90%',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 'bold', color: '#f87171', marginBottom: '0.75rem' }}>
              화면 표시 중 오차가 발생했습니다
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              앱 실행 중 예기치 않은 오차가 수신되었습니다.<br />
              버튼을 눌러 안전하게 새로고침해 주세요.
            </p>

            <div style={{
              background: 'rgba(0,0,0,0.4)',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              color: '#ef4444',
              fontFamily: 'monospace',
              marginBottom: '1.5rem',
              wordBreak: 'break-all',
              textAlign: 'left'
            }}>
              {this.state.error?.message || "알 수 없는 런타임 오류가 발생했습니다."}
            </div>

            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '10px',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              🔄 앱 다시 열기 (새로고침)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
