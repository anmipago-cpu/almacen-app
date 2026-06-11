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
import { AuthProvider, useAuth } from './context/AuthContext';
import { useCategorias } from './hooks/useCategorias';

function AppInitializer() {
  useCategorias();
  return null;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1E3A5F' }}>
        <div className="text-white text-sm opacity-70">Cargando...</div>
      </div>
    );
  }

  if (!session) return <Login />;
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AuthGate>
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
        </AuthGate>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
