import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Recepcion } from './pages/Recepcion';
import { ConsumoSemanal } from './pages/ConsumoSemanal';
import { InventarioFisico } from './pages/InventarioFisico';
import { Alarmas } from './pages/Alarmas';
import { Historial } from './pages/Historial';
import { Catalogo } from './pages/Catalogo';
import { Proveedores } from './pages/Proveedores';
import { Inventario } from './pages/Inventario';
import { Buscador } from './pages/Buscador';
import { Parametros } from './pages/Parametros';
import { useCategorias } from './hooks/useCategorias';

function AppInitializer() {
  useCategorias();
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <AppInitializer />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/recepciones" element={<Recepcion />} />
          <Route path="/consumo-semanal" element={<ConsumoSemanal />} />
          <Route path="/inventario-fisico" element={<InventarioFisico />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/alarmas" element={<Alarmas />} />
          <Route path="/historial" element={<Historial />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/buscador" element={<Buscador />} />
          <Route path="/parametros" element={<Parametros />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
