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
  onConfirm,
  onCancel,
}: Props) {
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

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent.iconBg}`}
          >
            <Icon className={`w-5 h-5 ${accent.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            className="p-1.5 -mt-1 -mr-1 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          {mode === 'confirm' && (
            <button
              onClick={onCancel}
              disabled={busy}
              className="flex-1 py-2.5 text-slate-600 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-sm disabled:opacity-50 active:scale-95"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 py-2.5 font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 ${accent.button}`}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'alert' ? confirmLabel || 'OK' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}