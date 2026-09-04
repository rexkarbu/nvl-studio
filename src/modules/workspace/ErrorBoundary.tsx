import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[NVL ErrorBoundary] Uncaught error caught by boundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleEmergencySave = (): void => {
    try {
      // Look for latest manifest in localStorage or memory
      const dump = {
        timestamp: new Date().toISOString(),
        error: this.state.error?.message,
        stack: this.state.error?.stack,
        url: window.location.href,
      };
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nvl_crash_dump_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[NVL ErrorBoundary] Emergency dump failed:', err);
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary-screen" data-testid="error-boundary-fallback">
          <div className="error-boundary-card">
            <div className="error-boundary-icon">⚠️</div>
            <h2 className="error-boundary-title">Something went wrong in NVL Studio</h2>
            <p className="error-boundary-message">
              The application encountered an unexpected error. Your saved project files are safe on disk.
            </p>

            {this.state.error && (
              <div className="error-boundary-details">
                <div className="error-boundary-error-text">
                  {this.state.error.name}: {this.state.error.message}
                </div>
                {this.state.error.stack && (
                  <pre className="error-boundary-stack">{this.state.error.stack}</pre>
                )}
              </div>
            )}

            <div className="error-boundary-actions">
              <button
                className="action-btn btn-primary"
                onClick={this.handleReload}
                style={{ padding: '10px 18px', fontSize: '13px' }}
              >
                🔄 Reload Application
              </button>
              <button
                className="action-btn btn-outline"
                onClick={this.handleEmergencySave}
                style={{ padding: '10px 18px', fontSize: '13px' }}
              >
                💾 Export Crash Report
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
