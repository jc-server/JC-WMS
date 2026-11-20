import { useState, useEffect, useRef, type ReactNode } from 'react';
import { X, AlertTriangle, Loader2, Info } from 'lucide-react';

type Variant = 'danger' | 'warning' | 'default' | 'info';
type Mode = 'confirm' | 'alert';

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  mode?: Mode;
  busy?: boolean;
  /** Optional content rendered between the message and the action buttons. */
  children?: ReactNode;
  onConfirm?: () => void | Promise<void>;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  mode = 'confirm',
  busy = false,
  children,
  onConfirm,
  onCancel,
}: Props) {
  const [internalBusy, setInternalBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const effectiveBusy = busy || internalBusy;

  // Save / restore focus around open.
  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement | null;
      const t = setTimeout(() => {
        const firstButton = dialogRef.current?.querySelector<HTMLButtonElement>(
          'button:not(:disabled)'
        );
        firstButton?.focus();
      }, 0);
      return () => clearTimeout(t);
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus?.();
      previousActiveElement.current = null;
    }
  }, [open]);

  // Esc-to-close + focus trap.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !effectiveBusy) {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, effectiveBusy, onCancel]);

  if (!open) return null;

  const accent = {
    danger: {
      iconBg: 'bg-red-100 dark:bg-red-950/40',
      iconColor: 'text-red-600 dark:text-red-400',
      button: 'bg-red-600 hover:bg-red-700 text-white',
      Icon: AlertTriangle,
    },
    warning: {
      iconBg: 'bg-amber-100 dark:bg-amber-950/40',
      iconColor: 'text-amber-600 dark:text-amber-400',
      button: 'bg-amber-500 hover:bg-amber-600 text-white',
      Icon: AlertTriangle,
    },
    info: {
      iconBg: 'bg-blue-100 dark:bg-blue-950/40',
      iconColor: 'text-blue-600 dark:text-blue-400',
      button:
        'bg-slate-900 dark:bg-amber-400 hover:bg-slate-800 dark:hover:bg-amber-300 text-white dark:text-slate-900',
      Icon: Info,
    },
    default: {
      iconBg: 'bg-slate-100 dark:bg-zinc-800',
      iconColor: 'text-slate-600 dark:text-slate-300',
      button:
        'bg-slate-900 dark:bg-amber-400 hover:bg-slate-800 dark:hover:bg-amber-300 text-white dark:text-slate-900',
      Icon: Info,
    },
  }[variant];

  const Icon = accent.Icon;

  const handleConfirm = async () => {
    if (!onConfirm || effectiveBusy) return;
    const result = onConfirm();
    if (result && typeof (result as Promise<void>).then === 'function') {
      setInternalBusy(true);
      try {
        await result;
      } catch (err) {
        console.error('Confirm action failed:', err);
      } finally {
        setInternalBusy(false);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={effectiveBusy ? undefined : onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-5 pb-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent.iconBg}`}
          >
            <Icon className={`w-5 h-5 ${accent.iconColor}`} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              id="confirm-dialog-title"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              {title}
            </h3>
            <p
              id="confirm-dialog-message"
              className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed"
            >
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={effectiveBusy}
            aria-label="Close"
            className="p-1.5 -mt-1 -mr-1 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {children && <div className="px-5 pb-3">{children}</div>}

        <div className="flex gap-2 px-5 pb-5">
          {mode === 'confirm' && (
            <button
              onClick={onCancel}
              disabled={effectiveBusy}
              className="flex-1 py-2.5 text-slate-600 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-sm disabled:opacity-50 active:scale-95"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={effectiveBusy}
            className={`flex-1 py-2.5 font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 ${accent.button}`}
          >
            {effectiveBusy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'alert' ? confirmLabel || 'OK' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}