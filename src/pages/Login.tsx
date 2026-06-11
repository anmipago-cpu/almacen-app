import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type Vista = 'login' | 'recuperar';

export function Login() {
  const { signIn } = useAuth();
  const [vista, setVista] = useState<Vista>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(msg === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleRecuperar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError('Ingresa tu correo'); return; }
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setEnviado(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1E3A5F' }}>
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <span className="text-white text-2xl font-bold">A</span>
          </div>
          <h1 className="text-2xl font-bold text-white">AlmacénApp</h1>
          <p className="text-slate-300 text-sm mt-1">Control de inventario</p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          {vista === 'login' ? (
            <>
              <h2 className="text-lg font-semibold text-slate-900 mb-6">Iniciar sesión</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="correo@empresa.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
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
                  {loading ? 'Verificando...' : 'Ingresar'}
                </button>

                <button
                  type="button"
                  onClick={() => { setVista('recuperar'); setError(''); }}
                  className="w-full text-center text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Recuperar contraseña</h2>
              {enviado ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
                    ✓ Te enviamos un link a <strong>{email}</strong>. Revisa tu bandeja de entrada y sigue las instrucciones.
                  </div>
                  <button
                    onClick={() => { setVista('login'); setEnviado(false); }}
                    className="w-full text-center text-sm text-blue-600 hover:text-blue-800"
                  >
                    Volver al inicio de sesión
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRecuperar} className="space-y-4 mt-4">
                  <p className="text-sm text-slate-500">Ingresa tu correo y te enviaremos un link para restablecer tu contraseña.</p>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Correo electrónico</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="correo@empresa.com"
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
                    {loading ? 'Enviando...' : 'Enviar link de recuperación'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setVista('login'); setError(''); }}
                    className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
                  >
                    Volver al inicio de sesión
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          Acceso restringido — para obtener credenciales contacte al administrador
        </p>
      </div>
    </div>
  );
}
