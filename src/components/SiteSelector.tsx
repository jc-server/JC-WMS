import { useState } from 'react';
import {
  MapPin, Plus, X, ChevronDown, Trash2, Loader2, User, Phone, CalendarDays, Pencil,
} from 'lucide-react';
import { useSites, type Site, type SiteInput, type SiteStatus } from '@/hooks/useSites';
import ConfirmDialog from '@/components/ConfirmDialog';
import { todayStr } from '@/utils/date';

type Props = {
  currentSiteId: string | null;
  onSelectSite: (id: string) => void;
};

export default function SiteSelector({ currentSiteId, onSelectSite }: Props) {
  const { sites, loading, addSite, updateSite, deleteSite } = useSites();
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Site | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentSite = sites.find((s) => s.id === currentSiteId);

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    setDeletingBusy(true);
    try {
      await deleteSite(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setPendingDelete(null);
      setErrorMessage((err as Error).message);
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-sm text-white font-medium min-w-[140px]"
        >
          <MapPin className="w-4 h-4 text-amber-400" />
          <span className="flex-1 text-left truncate">
            {loading ? 'Loading...' : currentSite?.name ?? 'Select Site'}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-slate-200 dark:border-zinc-700 z-40 overflow-hidden">
              {sites.length === 0 && !loading && (
                <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  No sites yet. Create one below.
                </p>
              )}

              {sites.map((site) => (
                <div
                  key={site.id}
                  className={`flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer group ${
                    site.id === currentSiteId ? 'bg-amber-50 dark:bg-amber-950/30' : ''
                  }`}
                  onClick={() => {
                    onSelectSite(site.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <MapPin
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        site.id === currentSiteId ? 'text-amber-500' : 'text-slate-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          site.id === currentSiteId
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {site.name}
                      </p>
                      {(site.clientName || site.status) && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                          {site.status === 'Completed' ? '✓ Completed' : 'Active'}
                          {site.clientName ? ` · ${site.clientName}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSite(site);
                        setOpen(false);
                      }}
                      className="p-1 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      title="Edit site"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(site);
                        setOpen(false);
                      }}
                      className="p-1 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      title="Delete site"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={() => {
                  setShowAdd(true);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors border-t border-slate-100 dark:border-zinc-700"
              >
                <Plus className="w-4 h-4" /> Add New Site
              </button>
            </div>
          </>
        )}
      </div>

      {showAdd && (
        <SiteFormModal
          onClose={() => setShowAdd(false)}
          onSave={async (input) => {
            await addSite(input);
            setShowAdd(false);
          }}
        />
      )}

      {editingSite && (
        <SiteFormModal
          site={editingSite}
          onClose={() => setEditingSite(null)}
          onSave={async (input) => {
            await updateSite(editingSite.id, input);
            setEditingSite(null);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete Site?"
        message={
          pendingDelete
            ? `This will permanently delete "${pendingDelete.name}" and its entire ledger (transactions, expenses, client payments). Worker attendance and advances are not affected. This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete Site"
        cancelLabel="Keep it"
        variant="danger"
        busy={deletingBusy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDeleteConfirm}
      />

      <ConfirmDialog
        open={errorMessage !== null}
        mode="alert"
        variant="danger"
        title="Could Not Delete Site"
        message={errorMessage ?? ''}
        confirmLabel="OK"
        onCancel={() => setErrorMessage(null)}
      />
    </>
  );
}

export function SiteFormModal({
  site,
  onClose,
  onSave,
}: {
  site?: Site | null;
  onClose: () => void;
  onSave: (input: SiteInput) => Promise<void>;
}) {
  const [name, setName] = useState(site?.name ?? '');
  const [clientName, setClientName] = useState(site?.clientName ?? '');
  const [clientPhone, setClientPhone] = useState(site?.clientPhone ?? '');
  const [startDate, setStartDate] = useState(site?.startDate ?? todayStr);
  const [status, setStatus] = useState<SiteStatus>(site?.status ?? 'Active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        startDate,
        status,
      });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {site ? 'Edit Site Details' : 'Add New Site'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Site Name" required>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="e.g. Sharma Villa — Phase 1"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Client Name">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className={`${inputCls} pl-9`}
                  placeholder="Optional"
                />
              </div>
            </Field>
            <Field label="Client Phone">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className={`${inputCls} pl-9`}
                  placeholder="Optional"
                />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date">
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`${inputCls} pl-9`}
                />
              </div>
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SiteStatus)}
                className={inputCls}
              >
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
              </select>
            </Field>
          </div>

          {error && (
            <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 rounded-lg p-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full py-3 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {saving && <Loader2 className="w-5 h-5 animate-spin" />}
            {site ? 'Save Changes' : 'Create Site'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  'w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all text-sm';

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}