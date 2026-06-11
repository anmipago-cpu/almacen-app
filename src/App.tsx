import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Recepcion } from './pages/Recepcion';
import { Consumo } from './pages/Consumo';
import { InventarioFisico } from './pages/InventarioFisico';
import { Alarmas } from './pages/Alarmas';
import { Historial } from './pages/Historial';
import { Catalogo } from './pages/Catalogo';
import { Proveedores } from './pages/Proveedores';
import { Inventario } from './pages/Inventario';
import { Buscador } from './pages/Buscador';
import { Parametros } from './pages/Parametros';
import { Usuarios } from './pages/Usuarios';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useCategorias } from './hooks/useCategorias';
import { supabase } from './lib/supabase';

function AppInitializer() {
  useCategorias();
  return null;
}

function ProtectedApp() {
  const { session, loading, profile, profileChecked } = useAuth();

  if (loading || !profileChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1E3A5F' }}>
        <div className="text-white text-sm opacity-70">Cargando...</div>
      </div>
    );
  }

  if (!session) return <Login />;

  if (!loading && session && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1E3A5F' }}>
        <div className="bg-white rounded-3xl p-8 shadow-2xl text-center max-w-sm mx-4">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Acceso no autorizado</h2>
          <p className="text-sm text-slate-500 mb-6">Tu cuenta no tiene un perfil asignado. Contacta al administrador.</p>
          <button
            onClick={() => { supabase.auth.signOut(); }}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: '#1E3A5F' }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (!profile?.activo) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1E3A5F' }}>
        <div className="bg-white rounded-3xl p-8 shadow-2xl text-center max-w-sm mx-4">
          <div className="text-4xl mb-4">⛔</div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Cuenta desactivada</h2>
          <p className="text-sm text-slate-500 mb-6">Tu acceso ha sido desactivado. Contacta al administrador.</p>
          <button
            onClick={() => { supabase.auth.signOut(); }}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: '#1E3A5F' }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppInitializer />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/recepciones" element={<Recepcion />} />
          <Route path="/consumo-semanal" element={<Consumo />} />
          <Route path="/inventario-fisico" element={<InventarioFisico />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/alarmas" element={<Alarmas />} />
          <Route path="/historial" element={<Historial />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/buscador" element={<Buscador />} />
          <Route path="/parametros" element={<Parametros />} />
          <Route path="/usuarios" element={<Usuarios />} />
        </Routes>
      </Layout>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<ProtectedApp />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
