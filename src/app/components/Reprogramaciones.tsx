import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Badge } from '@/app/components/ui/badge';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { toast } from 'sonner';
import { RefreshCcw, ArrowLeft, Users, CalendarCheck2, CalendarRange, Loader2 } from 'lucide-react';
import type { CronogramaVacaciones, Personal, RangoVacaciones } from '@/app/types';
import { apiFetch } from '@/app/api';
import { useAuth } from '@/app/context/AuthContext';
import { puedeReprogramar, formatearRangoFechas, calcularDiasConFinDeSemana, generarIdVacacion, buscarSolapamientos } from '@/app/utils/vacationUtils';
import { parseISO, format, addDays, isFriday } from 'date-fns';
import { es } from 'date-fns/locale';

type NuevasFechas = Record<string, { inicio: string; fin: string }>;

type ReprogramacionModo = 'uno' | 'mantener';

export function Reprogramaciones() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [personal, setPersonal] = useState<Personal[]>([]);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [selectedPersonalId, setSelectedPersonalId] = useState('');
  const [cronogramas, setCronogramas] = useState<CronogramaVacaciones[]>([]);
  const [cronogramaLoading, setCronogramaLoading] = useState(false);

  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [selectedRangeIds, setSelectedRangeIds] = useState<string[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [modo, setModo] = useState<ReprogramacionModo>('uno');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [nuevasFechas, setNuevasFechas] = useState<NuevasFechas>({});

  const serializeRangeForApi = (
    rango: RangoVacaciones & { scheduleId: string; personalId: string },
  ) => {
    const { reprogramadoDesde, ...rest } = rango;
    return {
      ...rest,
      reprogramadoPor: rest.reprogramadoPor ?? null,
      esinadId: rest.esinadId ?? null,
    };
  };

  useEffect(() => {
    const loadPersonal = async () => {
      setPersonalLoading(true);
      try {
        const data = await apiFetch('/api/personal');
        setPersonal(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        toast.error('No se pudo cargar el personal');
      } finally {
        setPersonalLoading(false);
      }
    };
    if (isAuthenticated) loadPersonal();
  }, [isAuthenticated]);

  useEffect(() => {
    const loadCronogramas = async (personalId: string) => {
      setCronogramaLoading(true);
      try {
        const schedules = await apiFetch(`/api/schedules/${personalId}`);
        if (!Array.isArray(schedules)) {
          setCronogramas([]);
          setCronogramaLoading(false);
          return;
        }

        const enriched: CronogramaVacaciones[] = [];
        for (const schedule of schedules) {
          try {
            const ranges = await apiFetch(`/api/ranges/${schedule.id}`);
            enriched.push({ ...schedule, rangos: Array.isArray(ranges) ? ranges : [] });
          } catch (err) {
            console.error(err);
            enriched.push({ ...schedule, rangos: [] });
          }
        }
        setCronogramas(enriched);
      } catch (err) {
        console.error(err);
        toast.error('No se pudieron cargar los cronogramas');
        setCronogramas([]);
      } finally {
        setCronogramaLoading(false);
      }
    };

    if (selectedPersonalId) {
      loadCronogramas(selectedPersonalId);
    } else {
      setCronogramas([]);
      setSelectedScheduleId(null);
      setSelectedRangeIds([]);
      setModo('uno');
      setFechaInicio('');
      setFechaFin('');
      setNuevasFechas({});
    }
  }, [selectedPersonalId]);

  useEffect(() => {
    if (fechaInicio) {
      const inicio = parseISO(fechaInicio);
      if (isFriday(inicio)) {
        const domingo = addDays(inicio, 2);
        setFechaFin(format(domingo, 'yyyy-MM-dd'));
      }
    }
  }, [fechaInicio]);

  useEffect(() => {
    if (fechaFin) {
      const fin = parseISO(fechaFin);
      if (isFriday(fin)) {
        const domingo = addDays(fin, 2);
        setFechaFin(format(domingo, 'yyyy-MM-dd'));
      }
    }
  }, [fechaFin]);

  const selectedCronograma = useMemo(() => {
    if (!selectedScheduleId) return null;
    return cronogramas.find((c) => c.id === selectedScheduleId) || null;
  }, [cronogramas, selectedScheduleId]);

  const selectedRanges = useMemo(() => {
    if (!selectedCronograma) return [];
    return selectedRangeIds
      .map((id) => selectedCronograma.rangos.find((r) => r.id === id))
      .filter((rango): rango is RangoVacaciones => Boolean(rango));
  }, [selectedCronograma, selectedRangeIds]);

  const diasTotalesSeleccionados = useMemo(() => {
    return selectedRanges.reduce((sum, rango) => sum + rango.diasSolicitados, 0);
  }, [selectedRanges]);

  const handleToggleRango = (scheduleId: string, rango: RangoVacaciones, checked: boolean) => {
    if (!puedeReprogramar(rango.fechaInicio)) {
      toast.error('Solo se pueden reprogramar vacaciones futuras');
      return;
    }

    if ((selectedCronograma && selectedCronograma.id !== scheduleId) || (!selectedCronograma && selectedRangeIds.length && selectedScheduleId && selectedScheduleId !== scheduleId)) {
      toast.error('Limpie la selección actual antes de elegir un periodo de otro cronograma');
      return;
    }

    setSelectedScheduleId((prev) => (checked ? scheduleId : selectedRangeIds.length > 1 ? scheduleId : null));

    setSelectedRangeIds((prev) => {
      if (checked) {
        return [...prev, rango.id];
      }
      const updated = prev.filter((id) => id !== rango.id);
      if (!updated.length) {
        setSelectedScheduleId(null);
        setNuevasFechas({});
        setModo('uno');
        setFechaInicio('');
        setFechaFin('');
      }
      return updated;
    });

    setNuevasFechas((prev) => {
      if (checked) return prev;
      const updated = { ...prev };
      delete updated[rango.id];
      return updated;
    });
  };

  const resetForm = () => {
    setDialogOpen(false);
    setModo('uno');
    setFechaInicio('');
    setFechaFin('');
    setNuevasFechas({});
  };

  const handleReprogramar = async () => {
    if (!selectedCronograma || !selectedRanges.length) {
      toast.error('Seleccione al menos un periodo');
      return;
    }

    const { fechaInicioAnio, fechaFinAnio, rangos } = selectedCronograma;

    if (modo === 'uno') {
      if (!fechaInicio || !fechaFin) {
        toast.error('Complete la nueva fecha de inicio y fin');
        return;
      }

      const inicio = parseISO(fechaInicio);
      const fin = parseISO(fechaFin);

      if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
        toast.error('Fechas inválidas');
        return;
      }

      if (inicio > fin) {
        toast.error('La fecha de inicio no puede ser posterior a la fecha fin');
        return;
      }

      const periodoInicio = parseISO(fechaInicioAnio);
      const periodoFin = parseISO(fechaFinAnio);
      if (inicio < periodoInicio || fin > periodoFin) {
        toast.error('Las nuevas fechas deben estar dentro del periodo vacacional');
        return;
      }

      const { diasSolicitados, incluye_finde } = calcularDiasConFinDeSemana(inicio, fin);
      const diasDisponibles = diasTotalesSeleccionados;
      if (diasSolicitados > diasDisponibles) {
        toast.error(`Los días seleccionados (${diasSolicitados}) superan los días disponibles (${diasDisponibles})`);
        return;
      }

      const solapamiento = buscarSolapamientos([{ inicio: fechaInicio, fin: fechaFin }], selectedCronograma, selectedRangeIds);
      if (solapamiento) {
        toast.error(solapamiento);
        return;
      }

      const tiposOriginales = selectedRanges.map((r) => r.tipo);
      let nuevoTipo: 'flexible' | 'bloque' = diasSolicitados <= 7 ? 'flexible' : 'bloque';
      if (tiposOriginales.includes('bloque')) {
        nuevoTipo = 'bloque';
      }

      const nuevoRangoId = generarIdVacacion(true);
      const nuevoRango: RangoVacaciones & { scheduleId: string; personalId: string } = {
        id: nuevoRangoId,
        fechaInicio,
        fechaFin,
        diasSolicitados,
        tipo: nuevoTipo,
        incluye_finde,
        estado: 'activo',
        esAdelanto: false,
        reprogramadoDesde: selectedRangeIds,
        reprogramadoPor: null,
        scheduleId: selectedCronograma.id,
        personalId: selectedCronograma.personalId,
      };

      const rangosActualizados = rangos.map((r) => (selectedRangeIds.includes(r.id) ? { ...r, estado: 'reprogramado', reprogramadoPor: nuevoRangoId } : r));
      const rangosConNuevo = [...rangosActualizados, nuevoRango];

      let diasFlexiblesUsados = selectedCronograma.diasFlexiblesUsados;
      let diasBloqueUsados = selectedCronograma.diasBloqueUsados;
      selectedRanges.forEach((r) => {
        if (r.tipo === 'flexible') diasFlexiblesUsados -= r.diasSolicitados;
        else diasBloqueUsados -= r.diasSolicitados;
      });
      if (nuevoTipo === 'flexible') diasFlexiblesUsados += diasSolicitados;
      else diasBloqueUsados += diasSolicitados;

      const diasSobrantes = diasDisponibles - diasSolicitados;
      if (diasSobrantes > 0) {
        if (diasFlexiblesUsados + diasSobrantes <= selectedCronograma.diasFlexiblesDisponibles) diasFlexiblesUsados += diasSobrantes;
        else diasBloqueUsados += diasSobrantes;
      }

      try {
        await apiFetch('/api/ranges', {
          method: 'POST',
          body: JSON.stringify(serializeRangeForApi(nuevoRango)),
        });

        await Promise.all(
          selectedRanges.map((rango) =>
            apiFetch(`/api/ranges/${rango.id}`, {
              method: 'PUT',
              body: JSON.stringify({ estado: 'reprogramado', reprogramadoPor: nuevoRangoId }),
            }),
          ),
        );

        await apiFetch('/api/reprogramaciones', {
          method: 'POST',
          body: JSON.stringify({ mappings: selectedRangeIds.map((originalRangeId) => ({ originalRangeId, newRangeId: nuevoRangoId })) }),
        });

        await apiFetch(`/api/schedules/${selectedCronograma.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            id: selectedCronograma.id,
            personalId: selectedCronograma.personalId,
            anioVacacional: selectedCronograma.anioVacacional,
            fechaInicioAnio: selectedCronograma.fechaInicioAnio,
            fechaFinAnio: selectedCronograma.fechaFinAnio,
            diasTotales: selectedCronograma.diasTotales,
            diasFlexiblesDisponibles: selectedCronograma.diasFlexiblesDisponibles,
            diasFlexiblesUsados,
            diasBloqueDisponibles: selectedCronograma.diasBloqueDisponibles,
            diasBloqueUsados,
            diasAdelanto: selectedCronograma.diasAdelanto,
            estado: selectedCronograma.estado,
          }),
        });

        setCronogramas((prev) => prev.map((c) => (c.id === selectedCronograma.id ? { ...c, rangos: rangosConNuevo, diasFlexiblesUsados, diasBloqueUsados } : c)));
        setSelectedRangeIds([]);
        setSelectedScheduleId(null);
        resetForm();
        toast.success('Reprogramación aplicada');
      } catch (err) {
        console.error(err);
        toast.error('No se pudo completar la reprogramación');
      }

      return;
    }

    if (modo === 'mantener') {
      const nuevasFechasList = selectedRangeIds.map((id) => nuevasFechas[id]);
      if (nuevasFechasList.some((nf) => !nf || !nf.inicio || !nf.fin)) {
        toast.error('Complete las nuevas fechas para cada rango');
        return;
      }

      const nuevasFechasValidacion = nuevasFechasList.map((nf) => ({ inicio: nf.inicio, fin: nf.fin }));
      const solapamiento = buscarSolapamientos(nuevasFechasValidacion, selectedCronograma, selectedRangeIds);
      if (solapamiento) {
        toast.error(solapamiento);
        return;
      }

      const nuevosRangos: Array<RangoVacaciones & { scheduleId: string; personalId: string }> = [];
      let sumaNuevos = 0;

      for (const id of selectedRangeIds) {
        const nf = nuevasFechas[id];
        const inicio = parseISO(nf.inicio);
        const fin = parseISO(nf.fin);
        if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
          toast.error('Fechas inválidas en la reprogramación');
          return;
        }
        if (inicio > fin) {
          toast.error('Una fecha de inicio es posterior a la fecha fin');
          return;
        }
        const periodoInicio = parseISO(fechaInicioAnio);
        const periodoFin = parseISO(fechaFinAnio);
        if (inicio < periodoInicio || fin > periodoFin) {
          toast.error('Las fechas deben estar dentro del periodo vacacional');
          return;
        }
        const { diasSolicitados, incluye_finde } = calcularDiasConFinDeSemana(inicio, fin);
        sumaNuevos += diasSolicitados;
        const original = selectedRanges.find((r) => r.id === id);
        const tipo = diasSolicitados <= 7 ? 'flexible' : 'bloque';
        const nuevoRangoId = generarIdVacacion(true);
        nuevosRangos.push({
          id: nuevoRangoId,
          fechaInicio: nf.inicio,
          fechaFin: nf.fin,
          diasSolicitados,
          tipo,
          incluye_finde,
          estado: 'activo',
          esAdelanto: original?.esAdelanto ?? false,
          reprogramadoDesde: [id],
          reprogramadoPor: null,
          scheduleId: selectedCronograma.id,
          personalId: selectedCronograma.personalId,
        });
      }

      const diasOriginales = diasTotalesSeleccionados;
      if (sumaNuevos > diasOriginales) {
        toast.error('Los días nuevos exceden los días disponibles');
        return;
      }

      let diasFlexiblesUsados = selectedCronograma.diasFlexiblesUsados;
      let diasBloqueUsados = selectedCronograma.diasBloqueUsados;
      selectedRanges.forEach((r) => {
        if (r.tipo === 'flexible') diasFlexiblesUsados -= r.diasSolicitados;
        else diasBloqueUsados -= r.diasSolicitados;
      });
      nuevosRangos.forEach((r) => {
        if (r.tipo === 'flexible') diasFlexiblesUsados += r.diasSolicitados;
        else diasBloqueUsados += r.diasSolicitados;
      });

      const sobrantes = diasOriginales - sumaNuevos;
      if (sobrantes > 0) {
        if (diasFlexiblesUsados + sobrantes <= selectedCronograma.diasFlexiblesDisponibles) diasFlexiblesUsados += sobrantes;
        else diasBloqueUsados += sobrantes;
      }

      try {
        await Promise.all(
          nuevosRangos.map((rango) =>
            apiFetch('/api/ranges', {
              method: 'POST',
              body: JSON.stringify(serializeRangeForApi(rango)),
            }),
          ),
        );

        await Promise.all(
          selectedRanges.map((rango) =>
            apiFetch(`/api/ranges/${rango.id}`, {
              method: 'PUT',
              body: JSON.stringify({ estado: 'reprogramado', reprogramadoPor: nuevosRangos.find((nr) => nr.reprogramadoDesde?.includes(rango.id))?.id ?? null }),
            }),
          ),
        );

        await apiFetch('/api/reprogramaciones', {
          method: 'POST',
          body: JSON.stringify({
            mappings: nuevosRangos.flatMap((nr) => (nr.reprogramadoDesde || []).map((originalRangeId) => ({ originalRangeId, newRangeId: nr.id }))),
          }),
        });

        await apiFetch(`/api/schedules/${selectedCronograma.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            id: selectedCronograma.id,
            personalId: selectedCronograma.personalId,
            anioVacacional: selectedCronograma.anioVacacional,
            fechaInicioAnio: selectedCronograma.fechaInicioAnio,
            fechaFinAnio: selectedCronograma.fechaFinAnio,
            diasTotales: selectedCronograma.diasTotales,
            diasFlexiblesDisponibles: selectedCronograma.diasFlexiblesDisponibles,
            diasFlexiblesUsados,
            diasBloqueDisponibles: selectedCronograma.diasBloqueDisponibles,
            diasBloqueUsados,
            diasAdelanto: selectedCronograma.diasAdelanto,
            estado: selectedCronograma.estado,
          }),
        });

        const rangosActualizados = selectedCronograma.rangos.map((r) => {
          if (!selectedRangeIds.includes(r.id)) return r;
          const nuevo = nuevosRangos.find((nr) => nr.reprogramadoDesde?.includes(r.id));
          return { ...r, estado: 'reprogramado', reprogramadoPor: nuevo?.id ?? null };
        });

        const cronogramaActualizado: CronogramaVacaciones = {
          ...selectedCronograma,
          rangos: [...rangosActualizados, ...nuevosRangos],
          diasFlexiblesUsados,
          diasBloqueUsados,
        };

        setCronogramas((prev) => prev.map((c) => (c.id === cronogramaActualizado.id ? cronogramaActualizado : c)));
        setSelectedRangeIds([]);
        setSelectedScheduleId(null);
        resetForm();
        toast.success('Reprogramación creada');
      } catch (err) {
        console.error(err);
        toast.error('No se pudo completar la reprogramación');
      }

      return;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <RefreshCcw className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Módulo de Reprogramaciones</h1>
              <p className="text-sm text-gray-500">Seleccione el personal y reprograme vacaciones futuras</p>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 overflow-x-hidden">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" /> Personal
            </CardTitle>
            <CardDescription>Seleccione un colaborador para ver sus cronogramas disponibles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-sm">
              <Select value={selectedPersonalId} onValueChange={setSelectedPersonalId} disabled={personalLoading}>
                <SelectTrigger>
                  {personalLoading ? <SelectValue placeholder="Cargando personal..." /> : <SelectValue placeholder="Seleccione un empleado" />}
                </SelectTrigger>
                <SelectContent>
                  {personal.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre} {p.apellido} - {p.puesto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedPersonalId && !cronogramaLoading && !cronogramas.length && (
              <Alert>
                <AlertDescription>No se encontraron cronogramas para el empleado seleccionado.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {cronogramaLoading && (
          <div className="flex items-center justify-center py-12 text-purple-700">
            <Loader2 className="animate-spin mr-2" /> Cargando cronogramas...
          </div>
        )}

        {!cronogramaLoading && cronogramas.length > 0 && (
          <div className="grid gap-6">
            {cronogramas.map((cronograma) => {
              const futuros = cronograma.rangos.filter((r) => (r.estado ?? 'activo') === 'activo' && puedeReprogramar(r.fechaInicio));
              return (
                <Card key={cronograma.id} className="border-purple-200 min-w-0">
                  <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="text-purple-900">Periodo {cronograma.anioVacacional}</CardTitle>
                      <CardDescription>
                        {format(parseISO(cronograma.fechaInicioAnio), 'dd/MM/yyyy', { locale: es })} - {format(parseISO(cronograma.fechaFinAnio), 'dd/MM/yyyy', { locale: es })}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 text-sm text-purple-700">
                      <span>Días flexibles usados: {cronograma.diasFlexiblesUsados}/{cronograma.diasFlexiblesDisponibles}</span>
                      <span>Días bloque usados: {cronograma.diasBloqueUsados}/{cronograma.diasBloqueDisponibles}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {futuros.length > 0 ? (
                      <div className="w-full overflow-x-auto">
                        <Table className="min-w-[700px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">Sel.</TableHead>
                              <TableHead>ID</TableHead>
                              <TableHead>Fechas</TableHead>
                              <TableHead>Días</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Estado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {futuros.map((rango) => {
                              const seleccionado = selectedRangeIds.includes(rango.id);
                              return (
                                <TableRow key={rango.id} className={seleccionado ? 'bg-purple-50' : ''}>
                                  <TableCell>
                                    <Checkbox
                                      checked={seleccionado}
                                      onCheckedChange={(checked) => handleToggleRango(cronograma.id, rango, Boolean(checked))}
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">{rango.id}</TableCell>
                                  <TableCell>{formatearRangoFechas(rango.fechaInicio, rango.fechaFin)}</TableCell>
                                  <TableCell>{rango.diasSolicitados}</TableCell>
                                  <TableCell>
                                    <Badge variant={rango.tipo === 'flexible' ? 'default' : 'secondary'}>
                                      {rango.tipo === 'flexible' ? 'Flexible' : 'Bloque'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge className="bg-green-100 text-green-800">Activo</Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <Alert>
                        <AlertDescription>No hay vacaciones futuras disponibles para reprogramar en este cronograma.</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {selectedRangeIds.length > 0 && selectedCronograma && (
          <Card className="border-purple-300 bg-white/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-900">
                <CalendarCheck2 className="w-5 h-5" /> Selección actual
              </CardTitle>
              <CardDescription>Revise los periodos seleccionados antes de reprogramar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-3 text-sm text-purple-800">
                <span>Periodos seleccionados: {selectedRangeIds.length}</span>
                <span>Días disponibles: {diasTotalesSeleccionados}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedRanges.map((rango) => (
                  <Badge key={rango.id} className="bg-purple-100 text-purple-800">
                    {rango.id} | <br/>
                    {formatearRangoFechas(rango.fechaInicio, rango.fechaFin)}
                  </Badge>
                ))}
              </div>
              <Button onClick={() => setDialogOpen(true)} className="bg-purple-600 hover:bg-purple-700">
                Reprogramar seleccionados
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarRange className="w-5 h-5" /> Reprogramar vacaciones
            </DialogTitle>
            <DialogDescription>
              Seleccionó {selectedRangeIds.length} periodo(s) con un total de {diasTotalesSeleccionados} día(s).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div>
              <Label>Seleccione el modo</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setModo('uno')}
                  className={`rounded-lg border p-3 text-left transition ${modo === 'uno' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}
                >
                  <p className="font-medium text-sm">Combinar en una sola vacación</p>
                  <p className="text-xs text-gray-500">Usa los días totales disponibles en un único rango</p>
                </button>
                <button
                  type="button"
                  onClick={() => setModo('mantener')}
                  className={`rounded-lg border p-3 text-left transition ${modo === 'mantener' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}
                >
                  <p className="font-medium text-sm">Mantener cantidad seleccionada</p>
                  <p className="text-xs text-gray-500">Reemplaza cada periodo con nuevas fechas</p>
                </button>
              </div>
            </div>

            {modo === 'uno' && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nueva fecha de inicio</Label>
                  <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Nueva fecha de fin</Label>
                  <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} min={fechaInicio || undefined} />
                </div>
              </div>
            )}

            {modo === 'mantener' && selectedRanges.length > 0 && (
              <div className="space-y-3">
                {selectedRanges.map((rango) => {
                  const nf = nuevasFechas[rango.id] || { inicio: '', fin: '' };
                  return (
                    <div key={rango.id} className="rounded-lg border border-purple-200 bg-white p-4">
                      <p className="text-sm font-medium text-purple-900">{rango.id} · {formatearRangoFechas(rango.fechaInicio, rango.fechaFin)}</p>
                      <p className="text-xs text-gray-500 mb-3">Días actuales: {rango.diasSolicitados}</p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Nueva fecha inicio</Label>
                          <Input
                            type="date"
                            value={nf.inicio}
                            onChange={(e) => setNuevasFechas((prev) => ({ ...prev, [rango.id]: { ...prev[rango.id], inicio: e.target.value } }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Nueva fecha fin</Label>
                          <Input
                            type="date"
                            value={nf.fin}
                            onChange={(e) => setNuevasFechas((prev) => ({ ...prev, [rango.id]: { ...prev[rango.id], fin: e.target.value } }))}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleReprogramar} className="bg-purple-600 hover:bg-purple-700">Confirmar reprogramación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
