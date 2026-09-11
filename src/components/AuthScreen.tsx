import { useState } from 'react';
import { Mail, Lock, Loader2, AlertCircle, Building2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AuthScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);
    if (result.error) setError(result.error);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-zinc-900 rounded-2xl mb-4 shadow-xl border border-zinc-800 overflow-hidden p-2">
            {!imgError ? (
              <img
                src="/logo.png"
                alt="Jaiswal Construction"
                className="w-full h-full object-contain rounded-xl"
                onError={() => setImgError(true)}
              />
            ) : (
              <Building2 className="w-10 h-10 text-amber-400" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Jaiswal Construction</h1>
          <p className="text-amber-400 mt-1 text-sm font-medium">Workers Management System</p>
        </div>

        <div className="bg-zinc-900 rounded-2xl p-6 sm:p-8 shadow-2xl border border-zinc-800">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-white">Admin Sign In</h2>
            <p className="text-slate-400 text-xs mt-1">Authorized access only</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-zinc-950 text-white rounded-xl border border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-zinc-950 text-white rounded-xl border border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-950/40 border border-red-800/50 rounded-xl p-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-400 text-slate-900 font-bold rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              Sign In to Dashboard
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
