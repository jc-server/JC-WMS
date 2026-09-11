import { useState } from 'react';
import { MapPin, Plus, X, ChevronDown, Trash2, Loader2 } from 'lucide-react';
import { useSites, type Site } from '@/hooks/useSites';

type Props = {
  currentSiteId: string | null;
  onSelectSite: (id: string) => void;
};

export default function SiteSelector({ currentSiteId, onSelectSite }: Props) {
  const { sites, loading, addSite, deleteSite } = useSites();
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  const currentSite = sites.find((s) => s.id === currentSiteId);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await addSite(newName.trim());
    setNewName('');
    setShowAdd(false);
  };

  const handleDelete = async (site: Site) => {
    if (!confirm(`Delete site "${site.name}" and all its data?`)) return;
    await deleteSite(site.id);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-sm text-white font-medium min-w-[140px]"
      >
        <MapPin className="w-4 h-4 text-amber-400" />
        <span className="flex-1 text-left truncate">
          {loading ? 'Loading...' : currentSite?.name ?? 'Select Site'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-slate-200 dark:border-zinc-700 z-40 overflow-hidden">
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
                onClick={() => { onSelectSite(site.id); setOpen(false); }}
              >
                <div className="flex items-center gap-2 flex-1">
                  <MapPin className={`w-4 h-4 ${site.id === currentSiteId ? 'text-amber-500' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${site.id === currentSiteId ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>
                    {site.name}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(site); }}
                  className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {showAdd ? (
              <form onSubmit={handleAdd} className="p-3 border-t border-slate-100 dark:border-zinc-700">
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Site name..."
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-zinc-600 focus:border-amber-400 outline-none text-sm"
                  />
                  <button type="submit" className="p-2 bg-amber-400 text-slate-900 rounded-lg hover:bg-amber-300 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setShowAdd(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowAdd(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors border-t border-slate-100 dark:border-zinc-700"
              >
                <Plus className="w-4 h-4" /> Add New Site
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
