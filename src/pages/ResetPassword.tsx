import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setSessionOk(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionOk(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return; }
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setListo(true);
    setTimeout(() => { window.location.href = '/'; }, 2500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1E3A5F' }}>
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <span className="text-white text-2xl font-bold">A</span>
          </div>
          <h1 className="text-2xl font-bold text-white">AlmacénApp</h1>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          {listo ? (
            <div className="text-center space-y-3">
              <div className="text-4xl">✓</div>
              <h2 className="text-lg font-semibold text-slate-900">Contraseña actualizada</h2>
              <p className="text-sm text-slate-500">Redirigiendo al inicio de sesión...</p>
            </div>
          ) : !sessionOk ? (
            <div className="text-center text-sm text-slate-500 py-4">
              Link inválido o expirado. Solicita un nuevo link desde la pantalla de login.
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Nueva contraseña</h2>
              <p className="text-sm text-slate-500 mb-5">Elige una contraseña segura para tu cuenta.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nueva contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoFocus
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar contraseña</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    placeholder="Repite la contraseña"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                  style={{ background: '#1E3A5F' }}
                >
                  {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
