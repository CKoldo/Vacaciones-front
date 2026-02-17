import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Settings, Edit2, ArrowLeft, Copy } from 'lucide-react';
import { toast } from 'sonner';
import type { CronogramaVacaciones, Personal } from '@/app/types';
import { formatearRangoFechas } from '@/app/utils/vacationUtils';
import { apiFetch } from "@/app/api";

export function Administracion() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAsignarTodosOpen, setDialogAsignarTodosOpen] = useState(false);
  const [editandoRangoId, setEditandoRangoId] = useState<string | null>(null);
  const [editandoCronogramaId, setEditandoCronogramaId] = useState<string | null>(null);
  const [nuevoEsinadId, setNuevoEsinadId] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'reprogramado'>('todos');
  const [filtroPersonal, setFiltroPersonal] = useState<string>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<'todos' | 'vacacion' | 'reprogramacion'>('todos');
  const [cronogramas, setCronogramas] = useState<CronogramaVacaciones[]>([]);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [esinidParaTodos, setEsinadParaTodos] = useState('');
  

  useEffect(() => {
    // Cargar datos desde la API
    async function loadData() {
      try {
        const personalData = await apiFetch('/api/personal');
        setPersonal(personalData);
        // Cargar cronogramas para cada personal
        let allCronogramas: CronogramaVacaciones[] = [];
        for (const p of personalData || []) {
          const schedules = await apiFetch(`/api/schedules/${p.id}`);
          for (const s of schedules) {
            // Cargar rangos para cada cronograma
            const rangos = await apiFetch(`/api/ranges/${s.id}`);
            allCronogramas.push({ ...s, rangos: rangos});
          }
        }
        setCronogramas(allCronogramas);
      } catch (err) {
        setPersonal([]);
        setCronogramas([]);
      }
    }
    loadData();
  }, []);

  // Obtener todos los rangos de todos los cronogramas
  const todosLosRangos = useMemo(() => {
    return cronogramas.flatMap(cron => 
      cron.rangos.map(rango => ({
        ...rango,
        cronogramaId: cron.id,
        personalId: cron.personalId,
        anioVacacional: cron.anioVacacional,
      }))
    );
  }, [cronogramas]);

  // Obtener tipos de vacaciones (VACACION o REPROGRAMACION)
  const obtenerTipoVacacion = (rango: any) => {
    return (rango.reprogramadoDesde && rango.reprogramadoDesde.length > 0) ? 'REPROGRAMACION' : 'VACACION';
  };

  // Contadores rápidos
  const cuentaVacaciones = todosLosRangos.filter(r => obtenerTipoVacacion(r) === 'VACACION').length;
  const cuentaReprogramaciones = todosLosRangos.filter(r => obtenerTipoVacacion(r) === 'REPROGRAMACION').length;

  // Filtrar rangos según estado, categoría y personal
  const rangosFiltrales = useMemo(() => {
    let filtered = todosLosRangos;

    // Filtro por estado
    if (filtroEstado !== 'todos') {
      filtered = filtered.filter(r => (r.estado ?? 'activo') === filtroEstado);
    }

    // Filtro por categoría (vacacion / reprogramacion)
    if (filtroCategoria && filtroCategoria !== 'todos') {
      filtered = filtered.filter(r => obtenerTipoVacacion(r) === (filtroCategoria === 'vacacion' ? 'VACACION' : 'REPROGRAMACION'));
    }

    // Filtro por personal
    if (filtroPersonal !== 'todos') {
      filtered = filtered.filter(r => r.personalId === filtroPersonal);
    }

    return filtered;
  }, [todosLosRangos, filtroEstado, filtroPersonal, filtroCategoria]);

  // Obtener nombre del personal
  const obtenerNombrePersonal = (personalId: string) => {
    const p = personal.find(x => x.id === personalId);
    return p ? `${p.nombre} ${p.apellido}` : 'Desconocido';
  };
  // Función para abrir el dialogo de edición
  const abrirDialogoEdicion = (cronogramaId: string, rangoId: string, esinadIdActual?: string) => {
    setEditandoCronogramaId(cronogramaId);
    setEditandoRangoId(rangoId);
    setNuevoEsinadId(esinadIdActual || '');
    setDialogOpen(true);
  };
  // Función para cerrar el dialogo de edición
  const guardarEsinad = () => {
    if (!editandoCronogramaId || !editandoRangoId) return;
    if (!nuevoEsinadId.trim()) {
      toast.error('Por favor, ingrese un ID de ESINAD');
      return;
    }
    // Actualizar el ESINAD en el servidor
    async function actualizarEsinad() {
      try {
        await apiFetch(`/api/ranges/${editandoRangoId}`, {
          method: 'PUT',
          body: JSON.stringify({ esinadId: nuevoEsinadId.trim() }),
        });
        // Recargar datos desde la API
        await recargarDatos();
        toast.success('ESINAD actualizado correctamente');
        setDialogOpen(false);
        setEditandoRangoId(null);
        setEditandoCronogramaId(null);
        setNuevoEsinadId('');
      } catch {
        toast.error('Error al actualizar ESINAD en el servidor');
      }
    }
    actualizarEsinad();
  };

  const guardarEsinadParaTodos = () => {
    if (!esinidParaTodos.trim()) {
      toast.error('Por favor, ingrese un ID de ESINAD');
      return;
    }
    async function asignarTodos() {
      let contadorActualizados = 0;
      try {
        for (const rango of rangosFiltrales) {
          if (!rango.esinadId) {
            await apiFetch(`/api/ranges/${rango.id}`, {
              method: 'PUT',
              body: JSON.stringify({ esinadId: esinidParaTodos.trim() }),
            });
            contadorActualizados++;
          }
        }
        await recargarDatos();
        toast.success(`${contadorActualizados} ESINAD asignados correctamente`);
        setDialogAsignarTodosOpen(false);
        setEsinadParaTodos('');
      } catch {
        toast.error('Error al asignar ESINAD a todos en el servidor');
      }
    }
    asignarTodos();
  };

  const eliminarEsinad = () => {
    if (!editandoCronogramaId || !editandoRangoId) return;
    async function eliminarEsinadApi() {
      try {
        await apiFetch(`/api/ranges/${editandoRangoId}`, {
          method: 'PUT',
          body: JSON.stringify({ esinadId: null }),
        });
        await recargarDatos();
        toast.success('ESINAD eliminado correctamente');
        setDialogOpen(false);
        setEditandoRangoId(null);
        setEditandoCronogramaId(null);
        setNuevoEsinadId('');
      } catch {
        toast.error('Error al eliminar ESINAD en el servidor');
      }
    }
    eliminarEsinadApi();
  };
  // Recargar todos los datos desde la API
  async function recargarDatos() {
    try {
      const personalData = await apiFetch('/api/personal');
      setPersonal(personalData || []);
      let allCronogramas: CronogramaVacaciones[] = [];
      for (const p of personalData || []) {
        const schedules = await apiFetch(`/api/schedules/${p.id}`);
        for (const s of schedules || []) {
          const rangos = await apiFetch(`/api/ranges/${s.id}`);
          allCronogramas.push({ ...s, rangos: rangos || [] });
        }
      }
      setCronogramas(allCronogramas);
    } catch {
      setPersonal([]);
      setCronogramas([]);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Administración de Vacaciones
              </h1>
              <p className="text-sm text-gray-500">
                Gestione ESINAD de vacaciones y reprogramaciones
              </p>
            </div>
          </div>
          <Button onClick={() => navigate('/home')} variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Settings className="w-5 h-5" />
              Administración de Vacaciones
            </CardTitle>
            <CardDescription className="text-blue-700">
              Gestione los documentos ESINAD asociados a las vacaciones y reprogramaciones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtros por estado */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={filtroEstado === 'todos' && filtroCategoria === 'todos' ? 'default' : 'outline'}
                    onClick={() => { setFiltroEstado('todos'); setFiltroCategoria('todos'); }}
                    size="sm"
                  >
                    Todos ({todosLosRangos.length})
                  </Button>
                  <Button
                    variant={filtroEstado === 'activo' && filtroCategoria === 'todos' ? 'default' : 'outline'}
                    onClick={() => { setFiltroEstado('activo'); setFiltroCategoria('todos'); }}
                    size="sm"
                  >
                    Activos ({todosLosRangos.filter(r => (r.estado ?? 'activo') === 'activo').length})
                  </Button>
                  <Button
                    variant={filtroEstado === 'reprogramado' ? 'default' : 'outline'}
                    onClick={() => { setFiltroEstado('todos'); setFiltroCategoria('reprogramacion'); }}
                    size="sm"
                  >
                    {/*Reprogramaciones ({todosLosRangos.filter(r => (r.estado ?? 'activo') === 'reprogramado').length})*/}
                    Reprogramaciones ({cuentaReprogramaciones})
                  </Button>
                  <Button
                    variant={filtroCategoria === 'vacacion' ? 'default' : 'outline'}
                    onClick={() => { setFiltroCategoria('vacacion'); setFiltroEstado('todos'); }}
                    size="sm"
                  >
                    Vacaciones ({cuentaVacaciones})
                  </Button>
                </div>
              </div>

              {/* Filtro por personal */}
              <div className="flex gap-3 items-end">
                <div className="flex-1 max-w-xs">
                  <Label htmlFor="filtro-personal" className="text-sm font-medium mb-2 block">
                    Filtrar por Personal
                  </Label>
                  <Select value={filtroPersonal} onValueChange={setFiltroPersonal}>
                    <SelectTrigger id="filtro-personal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {personal.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre} {p.apellido}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Botón para asignar ESINAD a todos */}
                {rangosFiltrales.length > 0 && (
                  (() => {
                    // Regla: si está en 'reprogramados' solo permitir si se seleccionó personal
                    // Si está en 'vacaciones' permitir siempre
                    // Si está en 'todos' o 'activo' deshabilitar a menos que la categoría sea 'vacacion'
                    const esReprogramado = filtroCategoria === 'reprogramacion';
                    const esVacacionCategoria = filtroCategoria === 'vacacion';
                    const permitirAsignar = esReprogramado
                      ? filtroPersonal !== 'todos'
                      : esVacacionCategoria
                        ? true
                        : !(filtroEstado === 'todos' || filtroEstado === 'activo');

                    return (
                      // Botón para asignar ESINAD a todos ocultado por defecto
                      <Button 
                        onClick={() => { if (permitirAsignar) setDialogAsignarTodosOpen(true); }}
                        className="bg-green-600 hover:bg-green-700 gap-2"
                        size="sm"
                        disabled={!permitirAsignar || permitirAsignar}
                      >
                        <Copy className="w-4 h-4" />
                        {/* Asignar ESINAD a Mostrados */}
                      </Button>
                    );
                  })()
                )}
              </div>
            </div>

            {rangosFiltrales.length > 0 ? (
              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-100">
                      <TableHead className="text-blue-900">Personal</TableHead>
                      <TableHead className="text-blue-900">Período Vacacional</TableHead>
                      <TableHead className="text-blue-900">Fechas</TableHead>
                      <TableHead className="text-blue-900">Días</TableHead>
                      <TableHead className="text-blue-900">Tipo</TableHead>
                      <TableHead className="text-blue-900">Categoría</TableHead>
                      <TableHead className="text-blue-900">Estado</TableHead>
                      <TableHead className="text-blue-900">ESINAD</TableHead>
                      <TableHead className="text-blue-900">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rangosFiltrales.map((rango) => (
                      <TableRow key={`${rango.cronogramaId}-${rango.id}`} className="hover:bg-blue-50">
                        <TableCell className="font-medium">
                          {obtenerNombrePersonal(rango.personalId)}
                        </TableCell>
                        <TableCell>{rango.anioVacacional}</TableCell>
                        <TableCell className="text-sm">
                          {formatearRangoFechas(rango.fechaInicio, rango.fechaFin)}
                        </TableCell>
                        <TableCell>{rango.diasSolicitados}</TableCell>
                        <TableCell>
                          <Badge variant={rango.tipo === 'flexible' ? 'default' : 'secondary'}>
                            {rango.tipo === 'flexible' ? 'Flexible' : 'Bloque'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={obtenerTipoVacacion(rango) === 'REPROGRAMACION' ? 'destructive' : 'default'}
                          >
                            {obtenerTipoVacacion(rango)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              (rango.estado ?? 'activo') === 'activo'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {(rango.estado ?? 'activo') === 'activo' ? 'Activo' : 'Reprogramado'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rango.esinadId ? (
                            <Badge className="bg-green-100 text-green-800">{rango.esinadId}</Badge>
                          ) : (
                            <span className="text-gray-400 text-sm">Sin ESINAD</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => abrirDialogoEdicion(rango.cronogramaId, rango.id, rango.esinadId)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  No hay vacaciones que mostrar con los filtros seleccionados
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Dialog para editar ESINAD individual */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar ESINAD</DialogTitle>
              <DialogDescription>
                Ingrese o edite el ID del documento ESINAD vinculado a esta vacación
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="esinad-id">ID del ESINAD</Label>
                <Input
                  id="esinad-id"
                  placeholder="Ejemplo: ESI-2026-001"
                  value={nuevoEsinadId}
                  onChange={(e) => setNuevoEsinadId(e.target.value)}
                />
              </div>
              <Alert>
                <AlertDescription className="text-sm">
                  El ESINAD es el documento que vincula la autorización de la reprogramación o vacación
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter className="flex justify-between">
              <div>
                {nuevoEsinadId && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={eliminarEsinad}
                  >
                    Eliminar ESINAD
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={guardarEsinad}>
                  Guardar
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para asignar ESINAD a todos los mostrados */}
        <Dialog open={dialogAsignarTodosOpen} onOpenChange={setDialogAsignarTodosOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Asignar ESINAD a Mostrados</DialogTitle>
              <DialogDescription>
                Ingrese el ID del ESINAD que se asignará a todos los {rangosFiltrales.length} registro(s) mostrado(s)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="esinad-todos">ID del ESINAD</Label>
                <Input
                  id="esinad-todos"
                  placeholder="Ejemplo: ESI-2026-001"
                  value={esinidParaTodos}
                  onChange={(e) => setEsinadParaTodos(e.target.value)}
                />
              </div>
              <Alert>
                <AlertDescription className="text-sm">
                  Se asignará solo a los registros que no tengan ESINAD. Los que ya tienen uno serán ignorados.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter className="flex justify-between">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDialogAsignarTodosOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={guardarEsinadParaTodos} className="bg-green-600 hover:bg-green-700">
                  Asignar a Todos
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}


