import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Edit2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/app/api';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import type { CronogramaVacaciones, Personal } from '@/app/types';
import {
  crearSiguienteCronogramaAnticipado,
  obtenerCronogramasFaltantes,
  recalcularCronogramasEnCascada,
  validarRangosEnCronogramas,
} from '@/app/utils/vacationUtils';

function aFechaInput(valorIso: string): string {
  return valorIso.split('T')[0];
}

function formatearFecha(valorIso: string): string {
  return format(parseISO(valorIso), 'dd/MM/yyyy', { locale: es });
}

function serializarCronograma(cronograma: CronogramaVacaciones) {
  return {
    id: cronograma.id,
    personalId: cronograma.personalId,
    anioVacacional: cronograma.anioVacacional,
    fechaInicioAnio: cronograma.fechaInicioAnio,
    fechaFinAnio: cronograma.fechaFinAnio,
    diasTotales: cronograma.diasTotales,
    diasFlexiblesDisponibles: cronograma.diasFlexiblesDisponibles,
    diasFlexiblesUsados: cronograma.diasFlexiblesUsados,
    diasBloqueDisponibles: cronograma.diasBloqueDisponibles,
    diasBloqueUsados: cronograma.diasBloqueUsados,
    diasAdelanto: cronograma.diasAdelanto,
    estado: cronograma.estado,
  };
}

export function EdicionCronogramas() {
  const navigate = useNavigate();
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [selectedPersonalId, setSelectedPersonalId] = useState('');
  const [cronogramas, setCronogramas] = useState<CronogramaVacaciones[]>([]);
  const [loadingPersonal, setLoadingPersonal] = useState(true);
  const [loadingCronogramas, setLoadingCronogramas] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [creandoSiguiente, setCreandoSiguiente] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cronogramaEditandoId, setCronogramaEditandoId] = useState<string | null>(null);
  const [nuevaFechaInicio, setNuevaFechaInicio] = useState('');

  async function cargarCronogramas(personalId: string) {
    setLoadingCronogramas(true);
    try {
      const schedules = await apiFetch(`/api/schedules/${personalId}`);
      const schedulesArray = Array.isArray(schedules) ? schedules : [];
      const enriched = await Promise.all(
        schedulesArray.map(async (schedule) => {
          const rangos = await apiFetch(`/api/ranges/${schedule.id}`);
          return {
            ...schedule,
            rangos: Array.isArray(rangos) ? rangos : [],
          } as CronogramaVacaciones;
        }),
      );
      setCronogramas(enriched);
    } catch {
      setCronogramas([]);
      toast.error('No se pudieron cargar los cronogramas');
    } finally {
      setLoadingCronogramas(false);
    }
  }

  useEffect(() => {
    async function cargarPersonal() {
      setLoadingPersonal(true);
      try {
        const personalData = await apiFetch('/api/personal');
        setPersonal(Array.isArray(personalData) ? personalData : []);
      } catch {
        setPersonal([]);
        toast.error('No se pudo cargar el personal');
      } finally {
        setLoadingPersonal(false);
      }
    }

    cargarPersonal();
  }, []);

  useEffect(() => {
    if (!selectedPersonalId) {
      setCronogramas([]);
      return;
    }

    cargarCronogramas(selectedPersonalId);
  }, [selectedPersonalId]);

  const cronogramasOrdenados = useMemo(
    () =>
      [...cronogramas].sort(
        (a, b) => parseISO(a.fechaInicioAnio).getTime() - parseISO(b.fechaInicioAnio).getTime(),
      ),
    [cronogramas],
  );

  const cronogramaEditando = useMemo(
    () => cronogramasOrdenados.find((cronograma) => cronograma.id === cronogramaEditandoId) ?? null,
    [cronogramasOrdenados, cronogramaEditandoId],
  );

  const personalSeleccionado = personal.find((persona) => persona.id === selectedPersonalId) ?? null;
  const ultimoCronograma = cronogramasOrdenados.at(-1) ?? null;
  const cronogramasFaltantes = personalSeleccionado
    ? obtenerCronogramasFaltantes(
        personalSeleccionado.fechaIngreso,
        personalSeleccionado.id,
        cronogramasOrdenados,
      )
    : [];
  const siguienteCronogramaAnticipado = personalSeleccionado
    ? crearSiguienteCronogramaAnticipado(
        personalSeleccionado.fechaIngreso,
        personalSeleccionado.id,
        cronogramasOrdenados,
      )
    : null;

  const validacionEdicion = useMemo(() => {
    if (!cronogramaEditando || !nuevaFechaInicio) {
      return {
        recalculados: [] as CronogramaVacaciones[],
        afectados: [] as CronogramaVacaciones[],
        inconsistencias: [] as ReturnType<typeof validarRangosEnCronogramas>,
        error: '',
      };
    }

    const indiceBase = cronogramasOrdenados.findIndex((cronograma) => cronograma.id === cronogramaEditando.id);
    const cronogramaAnterior = indiceBase > 0 ? cronogramasOrdenados[indiceBase - 1] : null;
    const nuevaFechaBase = startOfDay(parseISO(nuevaFechaInicio)).getTime();

    if (Number.isNaN(nuevaFechaBase)) {
      return {
        recalculados: [] as CronogramaVacaciones[],
        afectados: [] as CronogramaVacaciones[],
        inconsistencias: [] as ReturnType<typeof validarRangosEnCronogramas>,
        error: 'La nueva fecha no es válida.',
      };
    }

    if (cronogramaAnterior) {
      const finAnterior = startOfDay(parseISO(cronogramaAnterior.fechaFinAnio)).getTime();
      if (nuevaFechaBase < finAnterior) {
        return {
          recalculados: [] as CronogramaVacaciones[],
          afectados: [] as CronogramaVacaciones[],
          inconsistencias: [] as ReturnType<typeof validarRangosEnCronogramas>,
          error: `La nueva fecha de inicio no puede ser anterior al cierre del periodo previo (${formatearFecha(cronogramaAnterior.fechaFinAnio)}).`,
        };
      }
    }

    try {
      const recalculados = recalcularCronogramasEnCascada(
        cronogramasOrdenados,
        cronogramaEditando.id,
        nuevaFechaInicio,
      );
      const afectados = recalculados.slice(indiceBase);
      const inconsistencias = validarRangosEnCronogramas(afectados);

      return {
        recalculados,
        afectados,
        inconsistencias,
        error: '',
      };
    } catch (error) {
      return {
        recalculados: [] as CronogramaVacaciones[],
        afectados: [] as CronogramaVacaciones[],
        inconsistencias: [] as ReturnType<typeof validarRangosEnCronogramas>,
        error: error instanceof Error ? error.message : 'No se pudo recalcular la cascada.',
      };
    }
  }, [cronogramaEditando, cronogramasOrdenados, nuevaFechaInicio]);

  const abrirEdicion = (cronograma: CronogramaVacaciones) => {
    setCronogramaEditandoId(cronograma.id);
    setNuevaFechaInicio(aFechaInput(cronograma.fechaInicioAnio));
    setDialogOpen(true);
  };

  const cerrarDialogo = () => {
    if (guardando) return;
    setDialogOpen(false);
    setCronogramaEditandoId(null);
    setNuevaFechaInicio('');
  };

  const guardarCambios = async () => {
    if (!cronogramaEditando) return;
    if (validacionEdicion.error) {
      toast.error(validacionEdicion.error);
      return;
    }
    if (!validacionEdicion.afectados.length) {
      toast.error('No hay cambios para aplicar');
      return;
    }
    if (validacionEdicion.inconsistencias.length > 0) {
      toast.error('Existen rangos fuera del nuevo periodo. Revise la vista previa antes de guardar.');
      return;
    }

    setGuardando(true);
    try {
      await Promise.all(
        validacionEdicion.afectados.map((cronograma) =>
          apiFetch(`/api/schedules/${cronograma.id}`, {
            method: 'PUT',
            body: JSON.stringify(serializarCronograma(cronograma)),
          }),
        ),
      );

      const recalculadosPorId = new Map(
        validacionEdicion.recalculados.map((cronograma) => [cronograma.id, cronograma]),
      );

      setCronogramas((prev) =>
        prev.map((cronograma) => recalculadosPorId.get(cronograma.id) ?? cronograma),
      );
      toast.success(`Se actualizaron ${validacionEdicion.afectados.length} cronogramas en cascada`);
      cerrarDialogo();
    } catch {
      toast.error('No se pudieron guardar los cambios en los cronogramas');
    } finally {
      setGuardando(false);
    }
  };

  const sincronizarCronogramas = async () => {
    if (!personalSeleccionado || !cronogramasFaltantes.length) {
      toast.error('No hay cronogramas pendientes por sincronizar');
      return;
    }

    setSincronizando(true);
    try {
      await Promise.all(
        cronogramasFaltantes.map((cronograma) =>
          apiFetch('/api/schedules', {
            method: 'POST',
            body: JSON.stringify(cronograma),
          }),
        ),
      );

      await cargarCronogramas(personalSeleccionado.id);
      toast.success(`Se crearon ${cronogramasFaltantes.length} cronogramas faltantes`);
    } catch {
      toast.error('No se pudieron sincronizar los cronogramas faltantes');
    } finally {
      setSincronizando(false);
    }
  };

  const crearSiguienteCronograma = async () => {
    if (!personalSeleccionado || !siguienteCronogramaAnticipado) {
      toast.error('No se pudo preparar el siguiente cronograma');
      return;
    }

    setCreandoSiguiente(true);
    try {
      await apiFetch('/api/schedules', {
        method: 'POST',
        body: JSON.stringify(siguienteCronogramaAnticipado),
      });

      await cargarCronogramas(personalSeleccionado.id);
      toast.success(`Se creó el cronograma ${siguienteCronogramaAnticipado.anioVacacional}`);
    } catch {
      toast.error('No se pudo crear el siguiente cronograma');
    } finally {
      setCreandoSiguiente(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Edición de Cronogramas</h1>
            <p className="text-sm text-gray-500">Ajuste el inicio de un periodo y recalcule los periodos posteriores en cascada</p>
          </div>
          <Button onClick={() => navigate('/home')} variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">Regla de recálculo</CardTitle>
            <CardDescription className="text-amber-800">
              El periodo editado toma la nueva fecha de inicio, su fecha fin se recalcula a un año, y todos los cronogramas posteriores se recorren respetando esa nueva secuencia.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-md space-y-2">
              <Label>Colaborador</Label>
              <Select value={selectedPersonalId} onValueChange={setSelectedPersonalId} disabled={loadingPersonal}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingPersonal ? 'Cargando personal...' : 'Seleccione un colaborador'} />
                </SelectTrigger>
                <SelectContent>
                  {personal.map((persona) => (
                    <SelectItem key={persona.id} value={persona.id}>
                      {persona.nombre} {persona.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPersonalId && (
              <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-4">
                <div className="space-y-1 text-sm text-gray-600">
                  <p>
                    Último periodo registrado:{' '}
                    <span className="font-medium text-gray-900">
                      {ultimoCronograma ? ultimoCronograma.anioVacacional : 'Sin cronogramas'}
                    </span>
                  </p>
                  <p>
                    Sincronización automática pendiente:{' '}
                    <span className="font-medium text-gray-900">{cronogramasFaltantes.length}</span>
                  </p>
                  {siguienteCronogramaAnticipado && (
                    <p>
                      Siguiente periodo anticipado disponible:{' '}
                      <span className="font-medium text-gray-900">{siguienteCronogramaAnticipado.anioVacacional}</span>
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    className="gap-2"
                    onClick={sincronizarCronogramas}
                    disabled={loadingCronogramas || sincronizando || creandoSiguiente || !cronogramasFaltantes.length}
                  >
                    <Loader2 className={`w-4 h-4 ${sincronizando ? 'animate-spin' : ''}`} />
                    {sincronizando ? 'Sincronizando...' : 'Sincronizar cronogramas'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={crearSiguienteCronograma}
                    disabled={loadingCronogramas || creandoSiguiente || sincronizando || !siguienteCronogramaAnticipado}
                  >
                    {creandoSiguiente ? 'Creando...' : 'Crear siguiente cronograma'}
                  </Button>
                </div>
              </div>
            )}

            {!selectedPersonalId && (
              <Alert>
                <AlertDescription>Seleccione un colaborador para listar sus cronogramas.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {loadingCronogramas && (
          <Card>
            <CardContent className="py-10 flex items-center justify-center text-gray-600 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando cronogramas...
            </CardContent>
          </Card>
        )}

        {!loadingCronogramas && selectedPersonalId && !cronogramasOrdenados.length && (
          <Alert>
            <AlertDescription>No se encontraron cronogramas para el colaborador seleccionado.</AlertDescription>
          </Alert>
        )}

        {!loadingCronogramas && cronogramasOrdenados.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Cronogramas disponibles</CardTitle>
              <CardDescription>Seleccione el periodo desde el cual desea recalcular la cascada.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead>Rangos registrados</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cronogramasOrdenados.map((cronograma) => (
                    <TableRow key={cronograma.id}>
                      <TableCell>
                        <Badge variant="secondary">{cronograma.anioVacacional}</Badge>
                      </TableCell>
                      <TableCell>{formatearFecha(cronograma.fechaInicioAnio)}</TableCell>
                      <TableCell>{formatearFecha(cronograma.fechaFinAnio)}</TableCell>
                      <TableCell>{cronograma.rangos.length}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => abrirEdicion(cronograma)}>
                          <Edit2 className="w-4 h-4" />
                          Editar y recalcular
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Dialog open={dialogOpen} onOpenChange={(open) => (!open ? cerrarDialogo() : setDialogOpen(true))}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar cronograma base</DialogTitle>
              <DialogDescription>
                Cambie la fecha de inicio del periodo base y revise cómo quedarán los periodos siguientes antes de guardar.
              </DialogDescription>
            </DialogHeader>

            {cronogramaEditando && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Periodo base</Label>
                    <Input value={cronogramaEditando.anioVacacional} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Inicio actual</Label>
                    <Input value={aFechaInput(cronogramaEditando.fechaInicioAnio)} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Nueva fecha de inicio</Label>
                    <Input type="date" value={nuevaFechaInicio} onChange={(event) => setNuevaFechaInicio(event.target.value)} />
                  </div>
                </div>

                {validacionEdicion.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{validacionEdicion.error}</AlertDescription>
                  </Alert>
                )}

                {validacionEdicion.inconsistencias.length > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Hay {validacionEdicion.inconsistencias.length} rango(s) que quedarían fuera del nuevo periodo. Ajuste primero esas vacaciones o elija otra fecha base.
                    </AlertDescription>
                  </Alert>
                )}

                {validacionEdicion.afectados.length > 0 && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Vista previa del recálculo</h3>
                      <p className="text-sm text-gray-500">Se actualizarán {validacionEdicion.afectados.length} cronogramas desde el periodo seleccionado hacia adelante.</p>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Periodo actual</TableHead>
                          <TableHead>Inicio actual</TableHead>
                          <TableHead>Fin actual</TableHead>
                          <TableHead>Nuevo periodo</TableHead>
                          <TableHead>Nuevo inicio</TableHead>
                          <TableHead>Nuevo fin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validacionEdicion.afectados.map((cronogramaNuevo) => {
                          const cronogramaActual = cronogramasOrdenados.find((item) => item.id === cronogramaNuevo.id);
                          if (!cronogramaActual) return null;

                          return (
                            <TableRow key={cronogramaNuevo.id}>
                              <TableCell>{cronogramaActual.anioVacacional}</TableCell>
                              <TableCell>{formatearFecha(cronogramaActual.fechaInicioAnio)}</TableCell>
                              <TableCell>{formatearFecha(cronogramaActual.fechaFinAnio)}</TableCell>
                              <TableCell>
                                <Badge>{cronogramaNuevo.anioVacacional}</Badge>
                              </TableCell>
                              <TableCell>{formatearFecha(cronogramaNuevo.fechaInicioAnio)}</TableCell>
                              <TableCell>{formatearFecha(cronogramaNuevo.fechaFinAnio)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={cerrarDialogo} disabled={guardando}>Cancelar</Button>
              <Button onClick={guardarCambios} disabled={guardando || Boolean(validacionEdicion.error) || validacionEdicion.inconsistencias.length > 0}>
                {guardando ? 'Guardando...' : 'Guardar recálculo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}