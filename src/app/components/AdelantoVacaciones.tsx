import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { AlertTriangle, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import type { Personal, CronogramaVacaciones } from '@/app/types';
import { calcularDiasAdelantoDisponiblesEnPeriodo } from '@/app/utils/vacationUtils';

interface AdelantoVacacionesProps {
  empleado: Personal;
  cronograma: CronogramaVacaciones;
  onAdelantoAgregado: (cronogramaActualizado: CronogramaVacaciones) => void;
}

export function AdelantoVacaciones({ empleado, cronograma, onAdelantoAgregado }: AdelantoVacacionesProps) {
  const [diasAdelantoDisponibles, setDiasAdelantoDisponibles] = useState(0);
  const [diasAdelantoUsados, setDiasAdelantoUsados] = useState(0);
  const [cantidadAdelanto, setCantidadAdelanto] = useState<number | ''>('');

  useEffect(() => {
    // Calcular días de adelanto disponibles dentro del periodo hasta hoy
    const diasDisponibles = calcularDiasAdelantoDisponiblesEnPeriodo(cronograma.fechaInicioAnio);
    setDiasAdelantoDisponibles(diasDisponibles);

    // Calcular días de adelanto ya usados (almacenados en cronograma.diasAdelanto)
    const usados = cronograma.diasAdelanto || 0;
    setDiasAdelantoUsados(usados);
  }, [cronograma]);

  // Nota: los adelantos ahora se agregan directamente a días por bloque/disponibles

  const handleSolicitarAdelantoCantidad = (cantidad: number) => {
    const diasRestantes = diasAdelantoDisponibles - diasAdelantoUsados;
    if (cantidad <= 0) {
      toast.error('Ingrese una cantidad válida');
      return;
    }
    if (cantidad > diasRestantes) {
      toast.error(`Solo tienes ${diasRestantes} días de adelanto disponibles hasta este mes`);
      return;
    }

    // No se crean rangos: los días de adelanto se acumulan en días por bloque y en días totales
    const cronogramaActualizado: CronogramaVacaciones = {
      ...cronograma,
      diasAdelanto: (cronograma.diasAdelanto || 0) + cantidad,
      diasTotales: (cronograma.diasTotales || 30) + cantidad,
      diasBloqueDisponibles: (cronograma.diasBloqueDisponibles || 23) + cantidad,
    };

    onAdelantoAgregado(cronogramaActualizado);
    toast.success(`Adelanto de ${cantidad} días agregado a días por bloque y disponibles`);
    setCantidadAdelanto('');
  };

  const diasRestantes = diasAdelantoDisponibles - diasAdelantoUsados;

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-900">
          <Calendar className="w-5 h-5" />
          Adelanto de Vacaciones
        </CardTitle>
        <CardDescription className="text-orange-700">
          Solicite días de vacaciones por adelanto (2.5 días por mes trabajado)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumen de días de adelanto */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-white rounded-lg border border-orange-200">
          <div>
            <p className="text-xs text-gray-500">Disponibles</p>
            <p className="text-xl font-bold text-orange-600">{diasAdelantoDisponibles}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Usados</p>
            <p className="text-xl font-bold text-gray-900">{diasAdelantoUsados}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Restantes</p>
            <p className="text-xl font-bold text-green-600">{diasRestantes}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2">
            <Label htmlFor="cantidad-adelanto">Cantidad a adelantar (días)</Label>
            <Input
              id="cantidad-adelanto"
              type="number"
              step="0.5"
              min={0.5}
              max={diasAdelantoDisponibles - diasAdelantoUsados}
              value={cantidadAdelanto === '' ? '' : String(cantidadAdelanto)}
              onChange={(e) => setCantidadAdelanto(e.target.value === '' ? '' : parseFloat(e.target.value))}
            />
            <p className="text-xs text-gray-500">Máx: {diasAdelantoDisponibles - diasAdelantoUsados} días hasta este mes</p>
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => handleSolicitarAdelantoCantidad(Number(cantidadAdelanto))}
              className="w-full bg-orange-500 hover:bg-orange-600"
              disabled={!(cantidadAdelanto !== '' && Number(cantidadAdelanto) > 0) || diasRestantes <= 0}
            >
              Solicitar Adelanto
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
