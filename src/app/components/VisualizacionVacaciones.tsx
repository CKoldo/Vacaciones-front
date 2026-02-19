import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { ArrowLeft, Calendar, AlertCircle, FileSpreadsheet, FileText, Download } from 'lucide-react';
import type { Personal, CronogramaVacaciones, RangoVacaciones } from '@/app/types';
import { formatearRangoFechas, calcularDiasDisponibles } from '@/app/utils/vacationUtils';
import { apiFetch } from '@/app/api';
import { useAuth } from '@/app/context/AuthContext';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

export function VisualizacionVacaciones() {
  const navigate = useNavigate();
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [cronogramas, setCronogramas] = useState<CronogramaVacaciones[]>([]);
  const [selectedPersonalId, setSelectedPersonalId] = useState<string>('');

  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Cargar lista de personal desde backend
    async function loadPersonal() {
      try {
        const data = await apiFetch('/api/personal');
        setPersonal(data || []);
      } catch (err) {
        // fallback a vacío
        setPersonal([]);
      }
    }
    if (isAuthenticated) loadPersonal();
  }, [isAuthenticated]);

  useEffect(() => {
    // Cuando seleccionan un personal, cargar sus cronogramas y rangos desde backend
    async function loadCronogramas(personalId: string) {
      try {
        const schedules = await apiFetch(`/api/schedules/${personalId}`);
        const enriched = [];
        for (const s of schedules) {
          try {
            const ranges = await apiFetch(`/api/ranges/${s.id}`);
            enriched.push({ ...s, rangos: ranges || [] });
          } catch {
            enriched.push({ ...s, rangos: [] });
          }
        }
        setCronogramas(enriched);
      } catch (err) {
        setCronogramas([]);
      }
    }
    if (selectedPersonalId) loadCronogramas(selectedPersonalId);
    else setCronogramas([]);
  }, [selectedPersonalId]);

  const selectedPersonal = personal.find((p) => p.id === selectedPersonalId);
  const personalCronogramas = cronogramas.filter((c) => c.personalId === selectedPersonalId);

  const getTipoColor = (tipo: 'flexible' | 'bloque') => {
    return tipo === 'flexible' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'aprobado':
        return 'bg-green-100 text-green-800';
      case 'rechazado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  // Exportar a Excel - Individual
  const exportarExcelIndividual = () => {
    if (!selectedPersonal || personalCronogramas.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const data: any[] = [];

    // Agregar información del empleado
    data.push(['REPORTE DE VACACIONES']);
    data.push([]);
    data.push(['Empleado:', `${selectedPersonal.nombre} ${selectedPersonal.apellido}`]);
    data.push(['Puesto:', selectedPersonal.puesto]);
    data.push(['Email:', selectedPersonal.email]);
    data.push(['Fecha de Ingreso:', format(parseISO(selectedPersonal.fechaIngreso), 'dd/MM/yyyy', { locale: es })]);
    data.push([]);

    personalCronogramas.forEach((cronograma) => {
      const diasDisponibles = calcularDiasDisponibles(cronograma);
      const totalUsado = cronograma.diasFlexiblesUsados + cronograma.diasBloqueUsados;

      data.push([`PERIODO VACACIONAL ${cronograma.anioVacacional}`]);
      data.push(['Desde:', format(parseISO(cronograma.fechaInicioAnio), 'dd/MM/yyyy', { locale: es })]);
      data.push(['Hasta:', format(parseISO(cronograma.fechaFinAnio), 'dd/MM/yyyy', { locale: es })]);
      data.push([]);
      data.push(['Resumen de Días:']);
      data.push(['Días Flexibles Disponibles:', diasDisponibles.flexibles, '/', cronograma.diasFlexiblesDisponibles]);
      data.push(['Días en Bloque Disponibles:', diasDisponibles.bloque, '/', cronograma.diasBloqueDisponibles]);
      data.push(['Total Disponible:', diasDisponibles.total]);
      data.push(['Total Usado:', totalUsado]);
      data.push(['Días de Adelanto:', cronograma.diasAdelanto || 0]);
      data.push([]);

      // Filtrar solo rangos activos
      const rangosActivos = cronograma.rangos.filter(r => r.estado === 'activo' || !r.estado);

        if (rangosActivos.length > 0) {
        data.push(['Vacaciones Programadas:']);
        data.push(['ID', 'Fecha Inicio', 'Fecha Fin', 'Días', 'Tipo', 'Incluye Fin de Semana', 'Es Adelanto', 'Estado', 'Vinculado Desde (IDs)']);

        rangosActivos.forEach((rango) => {
          data.push([
            rango.id,
            format(parseISO(rango.fechaInicio), 'dd/MM/yyyy', { locale: es }),
            format(parseISO(rango.fechaFin), 'dd/MM/yyyy', { locale: es }),
            rango.diasSolicitados,
            rango.tipo === 'flexible' ? 'Flexible' : 'Bloque',
            rango.incluye_finde ? 'Sí' : 'No',
            rango.esAdelanto ? 'Sí' : 'No',
            rango.estado === 'reprogramado' ? 'Reprogramado' : 'Activo',
            rango.reprogramadoDesde ? (Array.isArray(rango.reprogramadoDesde) ? rango.reprogramadoDesde.join(';') : String(rango.reprogramadoDesde)) : '',
          ]);
        });
      }

      // Agregar historial de reprogramaciones si existe
      const rangosReprogramados = cronograma.rangos.filter(r => r.estado === 'reprogramado');
      if (rangosReprogramados.length > 0) {
        data.push([]);
        data.push(['Historial de Reprogramaciones:']);
        data.push(['ID', 'Fecha Inicio', 'Fecha Fin', 'Días', 'Tipo', 'Estado', 'Vinculado Desde (ID)']);

        rangosReprogramados.forEach((rango) => {
          data.push([
            rango.id,
            format(parseISO(rango.fechaInicio), 'dd/MM/yyyy', { locale: es }),
            format(parseISO(rango.fechaFin), 'dd/MM/yyyy', { locale: es }),
            rango.diasSolicitados,
            rango.tipo === 'flexible' ? 'Flexible' : 'Bloque',
            'Reprogramado',
            rango.reprogramadoPor ? String(rango.reprogramadoPor) : '',
          ]);
        });
      }

      data.push([]);
      data.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vacaciones');

    // Ajustar anchos de columna
    ws['!cols'] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
    ];

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Vacaciones_${selectedPersonal.nombre}_${selectedPersonal.apellido}_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast.success('Excel exportado exitosamente');
  };

  // Exportar a PDF - Individual
  const exportarPDFIndividual = () => {
    if (!selectedPersonal || personalCronogramas.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const doc = new jsPDF();
    let yPos = 20;

    // Título
    doc.setFontSize(18);
    doc.text('REPORTE DE VACACIONES', 105, yPos, { align: 'center' });
    yPos += 15;

    // Información del empleado
    doc.setFontSize(12);
    doc.text(`Empleado: ${selectedPersonal.nombre} ${selectedPersonal.apellido}`, 20, yPos);
    yPos += 7;
    doc.text(`Puesto: ${selectedPersonal.puesto}`, 20, yPos);
    yPos += 7;
    doc.text(`Email: ${selectedPersonal.email}`, 20, yPos);
    yPos += 7;
    doc.text(`Fecha de Ingreso: ${format(parseISO(selectedPersonal.fechaIngreso), 'dd/MM/yyyy', { locale: es })}`, 20, yPos);
    yPos += 12;

    personalCronogramas.forEach((cronograma, index) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      const diasDisponibles = calcularDiasDisponibles(cronograma);
      const totalUsado = cronograma.diasFlexiblesUsados + cronograma.diasBloqueUsados;

      // Periodo
      doc.setFontSize(14);
      doc.text(`PERIODO VACACIONAL ${cronograma.anioVacacional}`, 20, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.text(`Del ${format(parseISO(cronograma.fechaInicioAnio), 'dd/MM/yyyy', { locale: es })} al ${format(parseISO(cronograma.fechaFinAnio), 'dd/MM/yyyy', { locale: es })}`, 20, yPos);
      yPos += 10;

      // Resumen
      doc.text(`Días Flexibles: ${diasDisponibles.flexibles}/${cronograma.diasFlexiblesDisponibles}`, 20, yPos);
      doc.text(`Días en Bloque: ${diasDisponibles.bloque}/${cronograma.diasBloqueDisponibles}`, 100, yPos);
      yPos += 6;
      doc.text(`Total Disponible: ${diasDisponibles.total} días`, 20, yPos);
      doc.text(`Total Usado: ${totalUsado} días`, 100, yPos);
      yPos += 6;
      doc.text(`Días de Adelanto: ${cronograma.diasAdelanto || 0} días`, 20, yPos);
      yPos += 10;

      // Rangos activos
      const rangosActivos = cronograma.rangos.filter(r => r.estado === 'activo' || !r.estado);

      if (rangosActivos.length > 0) {
        doc.setFontSize(11);
        doc.text('Vacaciones Programadas:', 20, yPos);
        yPos += 6;

        doc.setFontSize(9);
        rangosActivos.forEach((rango) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          let rangoText = `• ${formatearRangoFechas(rango.fechaInicio, rango.fechaFin)} - ${rango.diasSolicitados} días (${rango.tipo === 'flexible' ? 'Flexible' : 'Bloque'})${rango.esAdelanto ? ' - ADELANTO' : ''}`;
          if (rango.reprogramadoDesde && rango.reprogramadoDesde.length > 0) {
            rangoText += ` - Vinculado Desde: ${Array.isArray(rango.reprogramadoDesde) ? rango.reprogramadoDesde.join(';') : String(rango.reprogramadoDesde)}`;
          }
          doc.text(rangoText, 25, yPos);
          yPos += 5;
        });
      }

      yPos += 5;
    });

    // Pie de página
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(8);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')} - Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
    }

    doc.save(`Vacaciones_${selectedPersonal.nombre}_${selectedPersonal.apellido}_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF exportado exitosamente');
  };

  // Exportar a Excel - Todo el Personal
  const exportarExcelTodo = () => {
    if (personal.length === 0 || cronogramas.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }
    // Construir filas en formato plano: una fila por rango de vacaciones
    const rows: any[] = [];

    // Encabezado según imagen proporcionada
    rows.push([
      'ID PERSONAL',
      'EMAIL',
      'ID VACACIONES',
      'Estado',
      'Fecha Inicio',
      'Fecha Fin',
      'Días',
      'Tipo',
      'Adelanto',
      'Vinculado Desde (ID)'
    ]);

    personal.forEach((empleado) => {
      const empleadoCronogramas = cronogramas.filter(c => c.personalId === empleado.id);

      empleadoCronogramas.forEach((cronograma) => {
        cronograma.rangos.forEach((rango) => {
          const vinculado = rango.reprogramadoDesde
            ? (Array.isArray(rango.reprogramadoDesde) ? rango.reprogramadoDesde.join(',') : String(rango.reprogramadoDesde))
            : (rango.reprogramadoPor ? String(rango.reprogramadoPor) : '');

          rows.push([
            empleado.id,
            empleado.email,
            rango.id,
            rango.estado === 'reprogramado' ? 'Reprogramado' : 'Activo',
            format(parseISO(rango.fechaInicio), 'dd/MM/yyyy', { locale: es }),
            format(parseISO(rango.fechaFin), 'dd/MM/yyyy', { locale: es }),
            rango.diasSolicitados,
            rango.tipo === 'flexible' ? 'Flexible' : 'Bloque',
            rango.esAdelanto ? 'Sí' : 'No',
            vinculado,
          ]);
        });
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vacaciones');

    // Ajustar anchos de columna para legibilidad
    ws['!cols'] = [
      { wch: 18 }, // ID PERSONAL
      { wch: 30 }, // EMAIL
      { wch: 16 }, // ID VACACIONES
      { wch: 12 }, // Estado
      { wch: 12 }, // Fecha Inicio
      { wch: 12 }, // Fecha Fin
      { wch: 8 },  // Días
      { wch: 12 }, // Tipo
      { wch: 10 }, // Adelanto
      { wch: 28 }, // Vinculado Desde (ID)
    ];

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Vacaciones_Todo_Personal_${new Date().toISOString().split('T')[0]}.xlsx`);

    toast.success('Excel exportado exitosamente');
  };

  // Exportar a PDF - Todo el Personal
  const exportarPDFTodo = () => {
    if (personal.length === 0 || cronogramas.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const doc = new jsPDF();
    let yPos = 20;

    // Título
    doc.setFontSize(18);
    doc.text('REPORTE GENERAL DE VACACIONES', 105, yPos, { align: 'center' });
    yPos += 10;
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, 105, yPos, { align: 'center' });
    yPos += 15;

    personal.forEach((empleado, index) => {
      const empleadoCronogramas = cronogramas.filter(c => c.personalId === empleado.id);

      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }

      // Separador
      if (index > 0) {
        doc.setDrawColor(200, 200, 200);
        doc.line(20, yPos - 5, 190, yPos - 5);
      }

      // Empleado
      doc.setFontSize(12);
      doc.text(`${empleado.nombre} ${empleado.apellido}`, 20, yPos);
      yPos += 6;
      doc.setFontSize(9);
      doc.text(`${empleado.puesto} - ${empleado.email}`, 20, yPos);
      yPos += 8;

      if (empleadoCronogramas.length > 0) {
        empleadoCronogramas.forEach((cronograma) => {
          if (yPos > 260) {
            doc.addPage();
            yPos = 20;
          }

          const diasDisponibles = calcularDiasDisponibles(cronograma);
          const totalUsado = cronograma.diasFlexiblesUsados + cronograma.diasBloqueUsados;

          doc.setFontSize(10);
          doc.text(`Periodo ${cronograma.anioVacacional}:`, 25, yPos);
          yPos += 5;

          doc.setFontSize(8);
          doc.text(`Flexibles: ${diasDisponibles.flexibles}/${cronograma.diasFlexiblesDisponibles}`, 30, yPos);
          doc.text(`Bloque: ${diasDisponibles.bloque}/${cronograma.diasBloqueDisponibles}`, 80, yPos);
          doc.text(`Total: ${diasDisponibles.total}`, 130, yPos);
          doc.text(`Adelanto: ${cronograma.diasAdelanto || 0}`, 160, yPos);
          yPos += 6;

          const rangosActivos = cronograma.rangos.filter(r => r.estado === 'activo' || !r.estado);
          if (rangosActivos.length > 0) {
            rangosActivos.forEach((rango) => {
              if (yPos > 280) {
                doc.addPage();
                yPos = 20;
              }
              let texto = `• ${formatearRangoFechas(rango.fechaInicio, rango.fechaFin)} (${rango.diasSolicitados}d)${rango.esAdelanto ? ' ADL' : ''}`;
              if (rango.reprogramadoDesde && rango.reprogramadoDesde.length > 0) {
                texto += ` - Vinculado Desde: ${Array.isArray(rango.reprogramadoDesde) ? rango.reprogramadoDesde.join(';') : String(rango.reprogramadoDesde)}`;
              }
              doc.text(texto, 35, yPos);
              yPos += 4;
            });
          }

          const rangosReprogramados = cronograma.rangos.filter(r => r.estado === 'reprogramado');
          if (rangosReprogramados.length > 0) {
            doc.setFontSize(10);
            doc.text('Historial de Reprogramaciones:', 20, yPos);
            yPos += 6;
            doc.setFontSize(9);
            rangosReprogramados.forEach((rango) => {
              if (yPos > 270) {
                doc.addPage();
                yPos = 20;
              }
              const texto = `• ${rango.id} - ${formatearRangoFechas(rango.fechaInicio, rango.fechaFin)} (${rango.diasSolicitados}d) - Vinculado Desde: ${rango.reprogramadoPor ? String(rango.reprogramadoPor) : ''}`;
              doc.text(texto, 25, yPos);
              yPos += 5;
            });
            yPos += 5;
          }

          yPos += 3;
        });
      } else {
        doc.setFontSize(9);
        doc.text('Sin cronogramas', 25, yPos);
        yPos += 5;
      }

      yPos += 5;
    });

    // Pie de página
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(8);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
    }

    doc.save(`Vacaciones_Todo_Personal_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF exportado exitosamente');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button onClick={() => navigate('/home')} variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-lg">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    Visualización de Vacaciones
                  </h1>
                  <p className="text-sm text-gray-500">
                    Consulte los registros de vacaciones del personal
                  </p>
                </div>
              </div>
            </div>

             {/* Botones de exportación global */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={exportarExcelTodo} variant="outline" className="gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Excel Todo
              </Button>
              <Button onClick={exportarPDFTodo} variant="outline" className="gap-2">
                <FileText className="w-4 h-4" />
                PDF Todo
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Selector de Personal */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Seleccionar Personal</CardTitle>
                <CardDescription>
                  Elija un empleado para ver sus programaciones de vacaciones
                </CardDescription>
              </div>
              
              {selectedPersonalId && (
                <div className="flex gap-2">
                  <Button onClick={exportarExcelIndividual} variant="outline" size="sm" className="gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    Excel
                  </Button>
                  <Button onClick={exportarPDFIndividual} variant="outline" size="sm" className="gap-2">
                    <FileText className="w-4 h-4" />
                    PDF
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent>
            <Select value={selectedPersonalId} onValueChange={setSelectedPersonalId}>
              <SelectTrigger className="w-full md:w-96">
                <SelectValue placeholder="Seleccione un empleado" />
              </SelectTrigger>
              <SelectContent>
                {personal.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} {p.apellido} - {p.puesto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Información del Personal Seleccionado */}
        {selectedPersonal && (
          <div className="space-y-6">
            {/* Datos del Empleado */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Información del Empleado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Nombre Completo</p>
                    <p className="font-medium">{selectedPersonal.nombre} {selectedPersonal.apellido}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Puesto</p>
                    <p className="font-medium">{selectedPersonal.puesto}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{selectedPersonal.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Fecha de Ingreso</p>
                    <p className="font-medium">
                      {format(parseISO(selectedPersonal.fechaIngreso), 'dd/MM/yyyy', { locale: es })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resumen de Vacaciones por Periodo */}
            {personalCronogramas.length > 0 ? (
              personalCronogramas.map((cronograma) => {
                const diasDisponibles = calcularDiasDisponibles(cronograma);
                const totalUsado = cronograma.diasFlexiblesUsados + cronograma.diasBloqueUsados;
                const porcentajeUsado = (totalUsado / cronograma.diasTotales) * 100;

                return (
                  <Card key={cronograma.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Periodo Vacacional {cronograma.anioVacacional}</CardTitle>
                          <CardDescription>
                            Del {format(parseISO(cronograma.fechaInicioAnio), 'dd/MM/yyyy', { locale: es })} al{' '}
                            {format(parseISO(cronograma.fechaFinAnio), 'dd/MM/yyyy', { locale: es })}
                          </CardDescription>
                        </div>
                        <Badge className={getEstadoColor(cronograma.estado)}>
                          {cronograma.estado.charAt(0).toUpperCase() + cronograma.estado.slice(1)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Resumen de Días */}
                      <div className="grid md:grid-cols-5 gap-4 mb-6">
                        <Card className="bg-blue-50 border-blue-200">
                          <CardContent className="pt-6">
                            <p className="text-sm text-blue-600 mb-1">Días Flexibles</p>
                            <p className="text-2xl font-bold text-blue-900">
                              {diasDisponibles.flexibles} / {cronograma.diasFlexiblesDisponibles}
                            </p>
                            <p className="text-xs text-blue-600 mt-1">disponibles</p>
                          </CardContent>
                        </Card>

                        <Card className="bg-purple-50 border-purple-200">
                          <CardContent className="pt-6">
                            <p className="text-sm text-purple-600 mb-1">Días en Bloque</p>
                            <p className="text-2xl font-bold text-purple-900">
                              {diasDisponibles.bloque} / {cronograma.diasBloqueDisponibles}
                            </p>
                            <p className="text-xs text-purple-600 mt-1">disponibles</p>
                          </CardContent>
                        </Card>

                        <Card className="bg-green-50 border-green-200">
                          <CardContent className="pt-6">
                            <p className="text-sm text-green-600 mb-1">Total Disponible</p>
                            <p className="text-2xl font-bold text-green-900">
                              {diasDisponibles.total} días
                            </p>
                            <p className="text-xs text-green-600 mt-1">por programar</p>
                          </CardContent>
                        </Card>

                        <Card className="bg-orange-50 border-orange-200">
                          <CardContent className="pt-6">
                            <p className="text-sm text-orange-600 mb-1">Días Adelanto</p>
                            <p className="text-2xl font-bold text-orange-900">
                              {cronograma.diasAdelanto || 0} días
                            </p>
                            <p className="text-xs text-orange-600 mt-1">adelantados</p>
                          </CardContent>
                        </Card>

                        <Card className="bg-gray-50 border-gray-200">
                          <CardContent className="pt-6">
                            <p className="text-sm text-gray-600 mb-1">Programado</p>
                            <p className="text-2xl font-bold text-gray-900">
                              {Math.round(porcentajeUsado)}%
                            </p>
                            <p className="text-xs text-gray-600 mt-1">{totalUsado}/{cronograma.diasTotales} días</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Alerta si quedan días por programar */}
                      {diasDisponibles.total > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-yellow-900">
                              Días pendientes por programar
                            </p>
                            <p className="text-sm text-yellow-700 mt-1">
                              Este empleado tiene {diasDisponibles.total} días de vacaciones disponibles que aún no han sido programados.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Tabla de Rangos Programados */}
                      {cronograma.rangos.filter(r => r.estado === 'activo' || !r.estado).length > 0 ? (
                        <div>
                          <h3 className="font-semibold mb-3">Vacaciones Programadas</h3>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>ID</TableHead>
                                  <TableHead>Periodo</TableHead>
                                  <TableHead>Días</TableHead>
                                  <TableHead>Tipo</TableHead>
                                  <TableHead>Incluye Fin de Semana</TableHead>
                                  <TableHead>Adelanto</TableHead>
                                  <TableHead>Vinculado Desde (IDs)</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {cronograma.rangos.filter(r => r.estado === 'activo' || !r.estado).map((rango) => (
                                  <TableRow key={rango.id}>
                                    <TableCell className="font-mono text-xs text-gray-700">{rango.id}</TableCell>
                                    <TableCell>
                                      {formatearRangoFechas(rango.fechaInicio, rango.fechaFin)}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      {rango.diasSolicitados} días
                                    </TableCell>
                                    <TableCell>
                                      <Badge className={getTipoColor(rango.tipo)}>
                                        {rango.tipo.charAt(0).toUpperCase() + rango.tipo.slice(1)}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {rango.incluye_finde ? (
                                        <Badge className="bg-orange-100 text-orange-800">Sí</Badge>
                                      ) : (
                                        <Badge variant="outline">No</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {rango.esAdelanto ? (
                                        <Badge className="bg-orange-100 text-orange-800">Sí</Badge>
                                      ) : (
                                        <Badge variant="outline">No</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {rango.reprogramadoDesde && rango.reprogramadoDesde.length > 0 ? (
                                        <span className="text-sm text-gray-700">{Array.isArray(rango.reprogramadoDesde) ? rango.reprogramadoDesde.join(', ') : String(rango.reprogramadoDesde)}</span>
                                      ) : (
                                        <span className="text-sm text-gray-400">-</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>No hay vacaciones programadas para este periodo</p>
                        </div>
                      )}

                      {/* Historial de Reprogramaciones */}
                      {cronograma.rangos.filter(r => r.estado === 'reprogramado').length > 0 && (
                        <div className="mt-6">
                          <h3 className="font-semibold mb-3 flex items-center gap-2">
                            Historial de Reprogramaciones
                            <Badge variant="outline">Archivado</Badge>
                          </h3>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>ID</TableHead>
                                  <TableHead>Periodo Original</TableHead>
                                  <TableHead>Días</TableHead>
                                  <TableHead>Tipo</TableHead>
                                  <TableHead>Estado</TableHead>
                                  <TableHead>Vinculado Desde (ID)</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {cronograma.rangos.filter(r => r.estado === 'reprogramado').map((rango) => (
                                  <TableRow key={rango.id} className="opacity-60">
                                    <TableCell className="font-mono text-xs text-gray-700">{rango.id}</TableCell>
                                    <TableCell>
                                      {formatearRangoFechas(rango.fechaInicio, rango.fechaFin)}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      {rango.diasSolicitados} días
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className={getTipoColor(rango.tipo)}>
                                        {rango.tipo.charAt(0).toUpperCase() + rango.tipo.slice(1)}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="secondary">Reprogramado</Badge>
                                    </TableCell>
                                    <TableCell>
                                      {rango.reprogramadoPor ? (
                                        <span className="text-sm text-gray-700">{rango.reprogramadoPor}</span>
                                      ) : (
                                        <span className="text-sm text-gray-400">-</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No hay cronogramas de vacaciones registrados para este empleado</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Mensaje cuando no hay personal seleccionado */}
        {!selectedPersonalId && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Seleccione un empleado para visualizar sus vacaciones</p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
