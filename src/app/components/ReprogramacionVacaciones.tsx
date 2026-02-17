import { useState } from 'react';
import { useEffect } from 'react';
import { Button } from '@/app/components/ui/button'; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Badge } from '@/app/components/ui/badge';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { RefreshCcw, AlertTriangle, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import type { CronogramaVacaciones, RangoVacaciones } from '@/app/types';
import { puedeReprogramar, formatearRangoFechas, calcularDiasConFinDeSemana, generarIdVacacion, buscarSolapamientos } from '@/app/utils/vacationUtils';
import { parseISO, addDays, isFriday, format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ReprogramacionVacacionesProps {
  cronograma: CronogramaVacaciones;
  onReprogramacion: (cronogramaActualizado: CronogramaVacaciones) => void;
}

export function ReprogramacionVacaciones({ cronograma, onReprogramacion }: ReprogramacionVacacionesProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rangosSeleccionados, setRangosSeleccionados] = useState<string[]>([]);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [modo, setModo] = useState<'uno' | 'mantener'>('uno');
  const [nuevasFechas, setNuevasFechas] = useState<Record<string, { inicio: string; fin: string }>>({});

  // Obtener rangos que pueden ser reprogramados
  // Tratar rangos sin 'estado' como 'activo' (compatibilidad con datos previos)
  const rangosReprogramables = Array.isArray(cronograma.rangos)
    ? cronograma.rangos.filter(
        (r: RangoVacaciones) => (r.estado ?? 'activo') === 'activo' && puedeReprogramar(r.fechaInicio)
      )
    : [];

  const handleSeleccionRango = (rangoId: string, checked: boolean) => {
    if (checked) {
      // Máximo 2 rangos
      if (rangosSeleccionados.length >= 2) {
        toast.error('Solo puedes seleccionar máximo 2 rangos para reprogramar');
        return;
      }
      setRangosSeleccionados([...rangosSeleccionados, rangoId]);
    } else {
      setRangosSeleccionados(rangosSeleccionados.filter(id => id !== rangoId));
    }
  };

  // Auto-completar domingo si se selecciona viernes
  useEffect(() => {
    if (fechaInicio) {
      const inicio = parseISO(fechaInicio);
      if (isFriday(inicio)) {
        const domingo = addDays(inicio, 2);
        setFechaFin(format(domingo, 'yyyy-MM-dd'));
      }
    }
  }, [fechaInicio]);

  // Auto-completar domingo si se selecciona viernes como fin
  useEffect(() => {
    if (fechaFin) {
      const fin = parseISO(fechaFin);
      if (isFriday(fin)) {
        const domingo = addDays(fin, 2);
        setFechaFin(format(domingo, 'yyyy-MM-dd'));
      }
    }
  }, [fechaFin]);

  const handleReprogramar = () => {
    if (rangosSeleccionados.length === 0) {
      toast.error('Seleccione al menos un rango para reprogramar');
      return;
    }

    if (!fechaInicio || !fechaFin) {
      toast.error('Por favor, complete las nuevas fechas');
      return;
    }

    const inicio = parseISO(fechaInicio);
    const fin = parseISO(fechaFin);

    if (inicio > fin) {
      toast.error('La fecha de inicio no puede ser posterior a la fecha de fin');
      return;
    }

    // Verificar que las nuevas fechas estén dentro del periodo
    const inicioAnio = parseISO(cronograma.fechaInicioAnio);
    const finAnio = parseISO(cronograma.fechaFinAnio);

    if (inicio < inicioAnio || fin > finAnio) {
      toast.error(`Las fechas deben estar dentro del periodo vacacional: ${format(inicioAnio, 'dd/MM/yyyy', { locale: es })} - ${format(finAnio, 'dd/MM/yyyy', { locale: es })}`);
      return;
    }

    const rangosAReprogramar = cronograma.rangos.filter(r => rangosSeleccionados.includes(r.id));

    // Modo: "uno" -> crear un único rango con los días calculados de las nuevas fechas
    if (modo === 'uno') {
      const { diasSolicitados } = calcularDiasConFinDeSemana(inicio, fin);
      const diasTotalesReprogramados = rangosAReprogramar.reduce((sum, r) => sum + r.diasSolicitados, 0);

      if (diasSolicitados > diasTotalesReprogramados) {
        toast.error(`Los días solicitados (${diasSolicitados}) exceden los días disponibles de los rangos seleccionados (${diasTotalesReprogramados})`);
        return;
      }

      // Validar que no haya solapamiento con otros rangos
      const solapamiento = buscarSolapamientos([{ inicio: fechaInicio, fin: fechaFin }], cronograma, rangosSeleccionados);
      if (solapamiento) {
        toast.error(solapamiento);
        return;
      }

      // Determinar tipo del nuevo rango
      let nuevoTipo: 'flexible' | 'bloque' = diasSolicitados <= 7 ? 'flexible' : 'bloque';

      // Si había al menos un bloque y un flexible en originales, forzamos bloque y liberamos flexibles
      const tiposOriginales = rangosAReprogramar.map(r => r.tipo);
      if (tiposOriginales.includes('flexible') && tiposOriginales.includes('bloque')) {
        nuevoTipo = 'bloque';
      }
      const handleReprogramar = async () => {
      const nuevoRangoId = generarIdVacacion(true);
      const nuevoRango = {
        id: nuevoRangoId,
        fechaInicio,
        fechaFin,
        diasSolicitados,
        tipo: nuevoTipo,
        incluye_finde: isFriday(inicio),
        estado: 'activo' as const,
        reprogramadoDesde: rangosSeleccionados,
      };

      // Marcar los rangos antiguos como reprogramados
      const rangosActualizados = cronograma.rangos.map(r => (
        rangosSeleccionados.includes(r.id) ? { ...r, estado: 'reprogramado' as const, reprogramadoPor: nuevoRangoId } : r
      ));

      rangosActualizados.push(nuevoRango);

      // Actualizar contadores
      let diasFlexiblesUsados = cronograma.diasFlexiblesUsados;
      let diasBloqueUsados = cronograma.diasBloqueUsados;

      rangosAReprogramar.forEach(r => {
        if (r.tipo === 'flexible') diasFlexiblesUsados -= r.diasSolicitados;
        else diasBloqueUsados -= r.diasSolicitados;
      });

      if (nuevoRango.tipo === 'flexible') diasFlexiblesUsados += nuevoRango.diasSolicitados;
      else diasBloqueUsados += nuevoRango.diasSolicitados;

      const diasSobrantes = rangosAReprogramar.reduce((s, r) => s + r.diasSolicitados, 0) - diasSolicitados;
      if (diasSobrantes > 0) {
        if (diasFlexiblesUsados + diasSobrantes <= cronograma.diasFlexiblesDisponibles) diasFlexiblesUsados += diasSobrantes;
        else diasBloqueUsados += diasSobrantes;
      }

      const cronogramaActualizado = {
        ...cronograma,
        rangos: rangosActualizados,
        diasFlexiblesUsados,
        diasBloqueUsados,
      };

      onReprogramacion(cronogramaActualizado);
      toast.success('Vacaciones reprogramadas exitosamente');
      setRangosSeleccionados([]);
      setFechaInicio('');
      setFechaFin('');
      setDialogOpen(false);
      return;
    }

    // Modo: "mantener" -> crear N nuevos rangos con las nuevas fechas proporcionadas en nuevasFechas
    if (modo === 'mantener') {
      // Validar que haya nuevas fechas para cada rango seleccionado
      for (const id of rangosSeleccionados) {
        const nf = nuevasFechas[id];
        if (!nf || !nf.inicio || !nf.fin) {
          toast.error('Complete las nuevas fechas para cada periodo seleccionado');
          return;
        }
      }

      const nuevos: any[] = [];
      let sumaNuevos = 0;
      const nuevoBase = Date.now();
      
      // Validar fechas antes de procesar
      const fechasAValidar: Array<{ inicio: string; fin: string }> = [];
      for (const id of rangosSeleccionados) {
        const nf = nuevasFechas[id];
        fechasAValidar.push({ inicio: nf.inicio, fin: nf.fin });
        const ini = parseISO(nf.inicio);
        const finN = parseISO(nf.fin);
        if (ini > finN) {
          toast.error('Una fecha de inicio es posterior a la fecha de fin');
          return;
        }
      }

      // Validar que no hay solapamientos
      const solapamiento = buscarSolapamientos(fechasAValidar, cronograma, rangosSeleccionados);
      if (solapamiento) {
        toast.error(solapamiento);
        return;
      }

      // Procesar nuevos rangos
      for (const id of rangosSeleccionados) {
        const nf = nuevasFechas[id];
        const ini = parseISO(nf.inicio);
        const finN = parseISO(nf.fin);
        const { diasSolicitados } = calcularDiasConFinDeSemana(ini, finN);
        sumaNuevos += diasSolicitados;
        const nuevoId = generarIdVacacion(true);
        nuevos.push({ id: nuevoId, fechaInicio: nf.inicio, fechaFin: nf.fin, diasSolicitados, tipo: diasSolicitados <= 7 ? 'flexible' : 'bloque', incluye_finde: isFriday(ini), estado: 'activo', reprogramadoDesde: [id] });
      }

      const diasTotalesOriginales = rangosAReprogramar.reduce((s, r) => s + r.diasSolicitados, 0);
      if (sumaNuevos > diasTotalesOriginales) {
        toast.error('La suma de días de los nuevos periodos excede los días disponibles de los periodos seleccionados');
        return;
      }

      // Marcar antiguos como reprogramados (y enlazarlos con los nuevos)
      const mapaOriginalToNuevo: Record<string, string> = {};
      nuevos.forEach(nr => {
        if (Array.isArray(nr.reprogramadoDesde) && nr.reprogramadoDesde.length > 0) {
          mapaOriginalToNuevo[nr.reprogramadoDesde[0]] = nr.id;
        }
      });

      let rangosActualizados = cronograma.rangos.map(r => (
        rangosSeleccionados.includes(r.id)
          ? { ...r, estado: 'reprogramado' as const, reprogramadoPor: mapaOriginalToNuevo[r.id] || r.reprogramadoPor }
          : r
      ));

      // Agregar nuevos
      rangosActualizados = [...rangosActualizados, ...nuevos];

      // Ajustar contadores
      let diasFlexiblesUsados = cronograma.diasFlexiblesUsados;
      let diasBloqueUsados = cronograma.diasBloqueUsados;
      // Restar originales
      rangosAReprogramar.forEach(r => {
        if (r.tipo === 'flexible') diasFlexiblesUsados -= r.diasSolicitados;
        else diasBloqueUsados -= r.diasSolicitados;
      });
      // Sumar nuevos
      nuevos.forEach(nr => {
        if (nr.tipo === 'flexible') diasFlexiblesUsados += nr.diasSolicitados;
        else diasBloqueUsados += nr.diasSolicitados;
      });

      // Si sobran días, devolverlos como flexibles si es posible
      const diasSobrantes = diasTotalesOriginales - sumaNuevos;
      if (diasSobrantes > 0) {
        if (diasFlexiblesUsados + diasSobrantes <= cronograma.diasFlexiblesDisponibles) diasFlexiblesUsados += diasSobrantes;
        else diasBloqueUsados += diasSobrantes;
      }

      const cronogramaActualizado = {
        ...cronograma,
        rangos: rangosActualizados,
        diasFlexiblesUsados,
        diasBloqueUsados,
      };

      onReprogramacion(cronogramaActualizado);
      toast.success('Vacaciones reprogramadas exitosamente');
      setRangosSeleccionados([]);
      setNuevasFechas({});
      setDialogOpen(false);
      return;
    }
  };

  const diasTotalesSeleccionados = rangosSeleccionados
    .map(id => cronograma.rangos.find(r => r.id === id))
    .filter(r => r !== undefined)
    .reduce((sum, r) => sum + r!.diasSolicitados, 0);

  return (
    <>
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-900">
            <RefreshCcw className="w-5 h-5" />
            Reprogramación de Vacaciones
          </CardTitle>
          <CardDescription className="text-purple-700">
            Reprograme vacaciones futuras que aún no han iniciado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rangosReprogramables.length > 0 ? (
            <>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Solo puede reprogramar periodos cuya fecha de inicio sea posterior a hoy.
                  Seleccione hasta 2 rangos para combinar o modificar.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                {rangosReprogramables.map(rango => (
                  <div 
                    key={rango.id} 
                    className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200"
                  >
                    <Checkbox
                      id={rango.id}
                      checked={rangosSeleccionados.includes(rango.id)}
                      onCheckedChange={(checked) => handleSeleccionRango(rango.id, checked as boolean)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={rango.tipo === 'flexible' ? 'default' : 'secondary'}>
                          {rango.tipo === 'flexible' ? 'Flexible' : 'Bloque'}
                        </Badge>
                        {rango.esAdelanto && (
                          <Badge className="bg-orange-100 text-orange-800">Adelanto</Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium">
                        {formatearRangoFechas(rango.fechaInicio, rango.fechaFin)}
                      </p>
                      <p className="text-xs text-gray-600">
                        {rango.diasSolicitados} días
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {rangosSeleccionados.length > 0 && (
                <div className="p-3 bg-white rounded-md border border-purple-200">
                  <p className="text-sm font-medium text-purple-900">
                    Rangos seleccionados: {rangosSeleccionados.length}
                  </p>
                  <p className="text-sm text-gray-600">
                    Días totales disponibles: {diasTotalesSeleccionados}
                  </p>
                </div>
              )}

              <Button 
                onClick={() => setDialogOpen(true)}
                className="w-full bg-purple-600 hover:bg-purple-700"
                disabled={rangosSeleccionados.length === 0}
              >
                Reprogramar Seleccionados
              </Button>
            </>
          ) : (
            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertDescription>
                No hay periodos disponibles para reprogramar. Solo se pueden reprogramar
                vacaciones cuya fecha de inicio sea posterior a la fecha actual.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Dialog para nueva programación */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprogramar Vacaciones</DialogTitle>
            <DialogDescription>
              Ingrese las nuevas fechas para los {rangosSeleccionados.length} rango(s) seleccionado(s).
              Días totales disponibles: {diasTotalesSeleccionados}
            </DialogDescription>
          </DialogHeader>

              <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Modo de reprogramación</Label>
              <div className="flex gap-3 items-center">
                <label className="flex items-center gap-2">
                  <input type="radio" name="modo" checked={modo === 'uno'} onChange={() => setModo('uno')} />
                  <span className="text-sm">Un solo periodo con días totales</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="modo" checked={modo === 'mantener'} onChange={() => setModo('mantener')} />
                  <span className="text-sm">Mantener misma cantidad de periodos</span>
                </label>
              </div>
            </div>

            {modo === 'uno' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="nueva-inicio">Nueva Fecha Inicio</Label>
                  <Input
                    id="nueva-inicio"
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    min={cronograma.fechaInicioAnio.split('T')[0]}
                    max={cronograma.fechaFinAnio.split('T')[0]}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nueva-fin">Nueva Fecha Fin</Label>
                  <Input
                    id="nueva-fin"
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    min={fechaInicio || cronograma.fechaInicioAnio.split('T')[0]}
                    max={cronograma.fechaFinAnio.split('T')[0]}
                  />
                </div>

                {fechaInicio && fechaFin && (
                  <Alert>
                    <AlertDescription>
                      Días a utilizar: {parseISO(fechaFin).getTime() >= parseISO(fechaInicio).getTime() 
                        ? Math.floor((parseISO(fechaFin).getTime() - parseISO(fechaInicio).getTime()) / (1000 * 60 * 60 * 24)) + 1
                        : 0} de {diasTotalesSeleccionados} disponibles
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {modo === 'mantener' && (
              <div className="space-y-3">
                {rangosSeleccionados.map(id => {
                  const rango = cronograma.rangos.find(r => r.id === id)!;
                  const nf = nuevasFechas[id] || { inicio: '', fin: '' };
                  return (
                    <div key={id} className="grid sm:grid-cols-2 gap-2 p-2 bg-white rounded">
                      <div>
                        <p className="text-sm font-medium">Periodo original: {formatearRangoFechas(rango.fechaInicio, rango.fechaFin)}</p>
                        <p className="text-xs text-gray-600">Días originales: {rango.diasSolicitados}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input type="date" value={nf.inicio} onChange={(e) => setNuevasFechas(prev => ({ ...prev, [id]: { ...prev[id], inicio: e.target.value } }))} min={cronograma.fechaInicioAnio.split('T')[0]} max={cronograma.fechaFinAnio.split('T')[0]} />
                        <Input type="date" value={nf.fin} onChange={(e) => setNuevasFechas(prev => ({ ...prev, [id]: { ...prev[id], fin: e.target.value } }))} min={cronograma.fechaInicioAnio.split('T')[0]} max={cronograma.fechaFinAnio.split('T')[0]} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleReprogramar}>
              Confirmar Reprogramación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}}