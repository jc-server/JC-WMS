import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught render error:', error, info.componentStack);
  }

  handleReload = () => window.location.reload();

  handleReset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 border border-slate-200 dark:border-zinc-800">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-950/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              The app ran into an unexpected error. Try again, or reload the page.
              Your data is safe in the cloud.
            </p>
            <pre className="text-left text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-xl p-3 mb-6 overflow-x-auto max-h-32 whitespace-pre-wrap break-words">
              {this.state.error.message}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors text-sm active:scale-95"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors text-sm active:scale-95 flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" /> Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}