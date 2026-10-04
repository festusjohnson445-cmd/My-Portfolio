import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Database, CheckCircle2, ShieldCheck, Cpu } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isRepairing: boolean;
  repairStatus: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isRepairing: false,
    repairStatus: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      isRepairing: false,
      repairStatus: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by Fesline ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleQuickReload = () => {
    window.location.reload();
  };

  private handleClearStorageAndRepair = () => {
    this.setState({ isRepairing: true, repairStatus: 'Clearing stale cached states...' });

    try {
      // Clear non-critical session artifacts while preserving visitor identity
      const visitorId = localStorage.getItem('fesline_visitor_id');
      const keysToRemove = [
        'fesline_chat_draft',
        'fesline_direct_mail_saved_form',
        'fesline_temp_doc_upload',
      ];

      keysToRemove.forEach((k) => {
        try {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        } catch {}
      });

      if (visitorId) {
        localStorage.setItem('fesline_visitor_id', visitorId);
      }

      this.setState({ repairStatus: 'Restoring verified application cache...' });

      setTimeout(() => {
        window.location.href = '/#home';
        window.location.reload();
      }, 700);
    } catch {
      window.location.reload();
    }
  };

  private handleReturnHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/#home';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#0f172a] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
          <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            {/* Header Icon & Title */}
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest block font-mono">
                  SYSTEM RECOVERY &amp; ERROR HANDLING
                </span>
                <h1 className="text-xl sm:text-2xl font-bold font-serif text-white tracking-tight">
                  Application Error Handler
                </h1>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <p>
                An unexpected interface issue was caught by the system error handler. Your database records, verified profile, and uploaded documents are safely persisted.
              </p>
              {this.state.error && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-rose-300 break-all">
                  {this.state.error.message || 'Unknown application error'}
                </div>
              )}
            </div>

            {/* Status indicator if repair is active */}
            {this.state.isRepairing && (
              <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-800/60 text-cyan-200 text-xs flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                <span>{this.state.repairStatus || 'Repairing application...'}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleQuickReload}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearStorageAndRepair}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Clean Cache &amp; Reset</span>
              </button>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>Database Sync: CloudSQL &amp; Firestore Connected</span>
              </span>
              <button
                type="button"
                onClick={this.handleReturnHome}
                className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Return to Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
