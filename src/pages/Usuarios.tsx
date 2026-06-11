import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserPlus, Pencil, Check, X, ShieldCheck, Eye, Wrench } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, supabaseCreator } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Rol } from '../context/AuthContext';

interface UserProfile {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  created_at: string;
}

const ROL_OPTIONS: { value: Rol; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'admin',    label: 'Administrador', icon: ShieldCheck, color: 'text-blue-700 bg-blue-100 border-blue-200' },
  { value: 'operario', label: 'Operario',      icon: Wrench,      color: 'text-amber-700 bg-amber-100 border-amber-200' },
  { value: 'consulta', label: 'Solo lectura',  icon: Eye,         color: 'text-slate-600 bg-slate-100 border-slate-200' },
];

function RolBadge({ rol }: { rol: Rol }) {
  const opt = ROL_OPTIONS.find(o => o.value === rol)!;
  const Icon = opt.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${opt.color}`}>
      <Icon size={11} />
      {opt.label}
    </span>
  );
}

export function Usuarios() {
  const { profile: currentProfile } = useAuth();
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ nombre: string; rol: Rol }>({ nombre: '', rol: 'consulta' });
  const [guardando, setGuardando] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoPassword, setNuevoPassword] = useState('');
  const [nuevoRol, setNuevoRol] = useState<Rol>('operario');
  const [creando, setCreando] = useState(false);

  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('nombre');
    if (error) toast.error(error.message);
    else setUsuarios((data || []) as UserProfile[]);
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  function iniciarEdicion(u: UserProfile) {
    setEditandoId(u.id);
    setEditData({ nombre: u.nombre, rol: u.rol });
  }

  async function guardarEdicion(id: string) {
    setGuardando(true);
    const { error } = await supabase
      .from('user_profiles')
      .update({ nombre: editData.nombre, rol: editData.rol })
      .eq('id', id);
    if (error) { toast.error(error.message); }
    else {
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, ...editData } : u));
      toast.success('Usuario actualizado');
    }
    setEditandoId(null);
    setGuardando(false);
  }

  async function toggleActivo(u: UserProfile) {
    if (u.id === currentProfile?.id) {
      toast.error('No puedes desactivar tu propio usuario');
      return;
    }
    const { error } = await supabase
      .from('user_profiles')
      .update({ activo: !u.activo })
      .eq('id', u.id);
    if (error) { toast.error(error.message); return; }
    setUsuarios(prev => prev.map(p => p.id === u.id ? { ...p, activo: !p.activo } : p));
    toast.success(u.activo ? 'Usuario desactivado' : 'Usuario reactivado');
  }

  async function crearUsuario() {
    if (!nuevoNombre.trim() || !nuevoEmail.trim() || !nuevoPassword.trim()) {
      toast.error('Completa todos los campos');
      return;
    }
    if (nuevoPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setCreando(true);
    try {
      const { data, error } = await supabaseCreator.auth.signUp({
        email: nuevoEmail.trim().toLowerCase(),
        password: nuevoPassword,
      });
      if (error) throw error;
      if (!data.user) throw new Error('No se pudo crear el usuario en Supabase Auth');

      const { error: profileError } = await supabase.from('user_profiles').insert({
        id: data.user.id,
        nombre: nuevoNombre.trim(),
        email: nuevoEmail.trim().toLowerCase(),
        rol: nuevoRol,
        activo: true,
      });
      if (profileError) throw profileError;

      toast.success(`Usuario "${nuevoNombre.trim()}" creado correctamente`);
      setNuevoNombre('');
      setNuevoEmail('');
      setNuevoPassword('');
      setNuevoRol('operario');
      setShowForm(false);
      cargar();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear usuario';
      toast.error(msg === 'User already registered' ? 'Este correo ya está registrado' : msg);
    } finally {
      setCreando(false);
    }
  }

  return (
    <div>
      <Header
        title="Gestión de Usuarios"
        subtitle="Administra los accesos y roles del equipo."
        actions={
          <Button icon={<UserPlus size={16} />} onClick={() => setShowForm(v => !v)}>
            Nuevo usuario
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Crear nuevo usuario</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Nombre completo *</label>
              <input
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                placeholder="Ej: Luis Sarmiento"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Correo electrónico *</label>
              <input
                type="email"
                value={nuevoEmail}
                onChange={e => setNuevoEmail(e.target.value)}
                placeholder="correo@empresa.com"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Contraseña temporal *</label>
              <input
                type="password"
                value={nuevoPassword}
                onChange={e => setNuevoPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Rol *</label>
              <select
                value={nuevoRol}
                onChange={e => setNuevoRol(e.target.value as Rol)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROL_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={crearUsuario} loading={creando} icon={<UserPlus size={15} />}>
              Crear usuario
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            El usuario podrá iniciar sesión de inmediato con el correo y contraseña indicados.
          </p>
        </Card>
      )}

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando usuarios...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Correo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Rol</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 w-[100px]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">No hay usuarios registrados.</td></tr>
              )}
              {usuarios.map(u => {
                const isMe = u.id === currentProfile?.id;
                const isEditing = editandoId === u.id;
                return (
                  <tr key={u.id} className={`transition-colors ${!u.activo ? 'opacity-50' : 'hover:bg-slate-50/60'}`}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {isEditing ? (
                        <input
                          value={editData.nombre}
                          onChange={e => setEditData(p => ({ ...p, nombre: e.target.value }))}
                          className="rounded-lg border border-blue-300 px-2 py-1 text-sm w-full focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className="flex items-center gap-1.5">
                          {u.nombre}
                          {isMe && <span className="text-xs text-blue-500 font-normal">(tú)</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.email}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editData.rol}
                          onChange={e => setEditData(p => ({ ...p, rol: e.target.value as Rol }))}
                          className="rounded-lg border border-blue-300 px-2 py-1 text-sm focus:outline-none"
                        >
                          {ROL_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <RolBadge rol={u.rol} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        u.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => guardarEdicion(u.id)}
                              disabled={guardando}
                              title="Guardar"
                              className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              onClick={() => setEditandoId(null)}
                              title="Cancelar"
                              className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                            >
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => iniciarEdicion(u)}
                              title="Editar nombre y rol"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => toggleActivo(u)}
                              disabled={isMe}
                              title={u.activo ? 'Desactivar' : 'Reactivar'}
                              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30 ${
                                u.activo
                                  ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {u.activo ? <X size={13} /> : <Check size={13} />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <strong>Roles:</strong>{' '}
        <strong>Administrador</strong> — acceso total incluyendo catálogo, parámetros y usuarios ·{' '}
        <strong>Operario</strong> — puede registrar recepciones, consumos e inventario físico ·{' '}
        <strong>Solo lectura</strong> — solo puede ver dashboard, inventario, alarmas e historial
      </div>
    </div>
  );
}
