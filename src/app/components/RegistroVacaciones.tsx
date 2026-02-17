import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import {
  ArrowLeft,
  CalendarPlus,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import type {
  Personal,
  CronogramaVacaciones,
  RangoVacaciones,
} from "@/app/types";
import {
  calcularPeriodoVacacional,
  validarRangoVacaciones,
  calcularDiasDisponibles,
  formatearRangoFechas,
  calcularDiasConFinDeSemana,
  esViernes,
} from "@/app/utils/vacationUtils";
import { generarIdVacacion } from "@/app/utils/vacationUtils";
import {
  format,
  parseISO,
  differenceInDays,
  addDays,
  isFriday,
} from "date-fns";
import { es } from "date-fns/locale";
import { AdelantoVacaciones } from "@/app/components/AdelantoVacaciones";
import { ReprogramacionVacaciones } from "@/app/components/ReprogramacionVacaciones";
import { apiFetch } from "@/app/api";
import { useAuth } from "@/app/context/AuthContext";
import { generateUuid } from "@/app/utils/id";

export function RegistroVacaciones() {
  const navigate = useNavigate();
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [cronogramas, setCronogramas] = useState<CronogramaVacaciones[]>([]);
  const [selectedPersonalId, setSelectedPersonalId] = useState<string>("");
  const [selectedCronograma, setSelectedCronograma] =
    useState<CronogramaVacaciones | null>(null);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  useEffect(() => {
    // Cargar personal desde endpoint
    const fetchPersonal = async () => {
      try {
        const data = await apiFetch("/api/personal");
        setPersonal(data);
        //localStorage.setItem('personal', JSON.stringify(data));
      } catch (err) {
        // fallback a vacío
        setPersonal([]);
      }
    };
    fetchPersonal();

    // Cargar cronogramas desde endpoint
    const fetchCronogramas = async () => {
      try {
        const data = await apiFetch("/api/schedules");
        setCronogramas(data);
        //localStorage.setItem('cronogramas', JSON.stringify(data));
      } catch (err) {
        // fallback a vacío
        setCronogramas([]);
      }
    };
    fetchCronogramas();
  }, []);

    // Cuando se selecciona un personal, buscar cronograma asociado o crear uno nuevo si no existe
  useEffect(() => {
    const fetchOrCreateCronograma = async () => {
      if (selectedPersonalId) {
        const empleado = personal.find((p) => p.id === selectedPersonalId);
        if (empleado) {
          let cronograma = cronogramas.find((c) => c.personalId === selectedPersonalId);
          if (!cronograma) {
            // Crear nuevo cronograma en backend
            const periodo = calcularPeriodoVacacional(empleado.fechaIngreso);
            const newCronograma = {
              id: generateUuid(),
              personalId: empleado.id,
              anioVacacional: periodo.anioVacacional,
              fechaInicioAnio: periodo.fechaInicio,
              fechaFinAnio: periodo.fechaFin,
              diasTotales: 30,
              diasAdelanto: 0,
              diasFlexiblesDisponibles: 7,
              diasFlexiblesUsados: 0,
              diasBloqueDisponibles: 23,
              diasBloqueUsados: 0,
              rangos: [],
              estado: 'pendiente',
            };
            try {
              await apiFetch('/api/schedules', { method: 'POST', body: JSON.stringify(newCronograma) });
              cronograma = newCronograma;
              const newCronogramas = [...cronogramas, cronograma];
              setCronogramas(newCronogramas);
            } catch (err) {
              toast.error('Error creando cronograma en servidor');
              // fallback local
              cronograma = newCronograma;
              const newCronogramas = [...cronogramas, cronograma];
              setCronogramas(newCronogramas);
            }
          }
          setSelectedCronograma(cronograma);
        }
      } else {
        setSelectedCronograma(null);
      }
    };
    fetchOrCreateCronograma();

  }, [selectedPersonalId, personal, cronogramas]);

  useEffect(() => {
    const scheduleId = selectedCronograma?.id;
    if (!scheduleId) return;

    let cancelled = false;

    const loadRanges = async () => {
      try {
        const rangosResponse = await apiFetch(`/api/ranges/${scheduleId}`);
        if (cancelled) return;
        const rangosArray = Array.isArray(rangosResponse)
          ? rangosResponse
          : [];

        setSelectedCronograma((prev) =>
          prev && prev.id === scheduleId ? { ...prev, rangos: rangosArray } : prev,
        );
        setCronogramas((prev) =>
          prev.map((c) => (c.id === scheduleId ? { ...c, rangos: rangosArray } : c)),
        );
      } catch {
        if (cancelled) return;
        setSelectedCronograma((prev) =>
          prev && prev.id === scheduleId ? { ...prev, rangos: prev.rangos ?? [] } : prev,
        );
      }
    };

    loadRanges();

    return () => {
      cancelled = true;
    };
  }, [selectedCronograma?.id]);

  // Cuando se selecciona un viernes como fecha de inicio, automáticamente establecer domingo como fecha fin
  useEffect(() => {
    if (fechaInicio) {
      const inicio = parseISO(fechaInicio);
      if (isFriday(inicio)) {
        const domingo = addDays(inicio, 2); // Viernes + 2 días = Domingo
        setFechaFin(format(domingo, "yyyy-MM-dd"));
        toast.info(
          "Se seleccionó un viernes. La fecha fin se estableció automáticamente al domingo.",
        );
      }
    }
  }, [fechaInicio]);

  // Cuando se selecciona un viernes como fecha de fin, automáticamente establecer domingo como fecha fin
  useEffect(() => {
    if (fechaFin && fechaInicio) {
      const fin = parseISO(fechaFin);
      if (isFriday(fin)) {
        const domingo = addDays(fin, 2); // Viernes + 2 días = Domingo
        setFechaFin(format(domingo, "yyyy-MM-dd"));
        toast.info(
          "Se seleccionó un viernes como fecha de fin. Se extendió automáticamente hasta el domingo.",
        );
      }
    }
  }, [fechaFin, fechaInicio]);

  // Validar cuando cambian las fechas
  useEffect(() => {
    if (fechaInicio && fechaFin && selectedCronograma) {
      const inicio = parseISO(fechaInicio);
      const fin = parseISO(fechaFin);
      const validation = validarRangoVacaciones(
        inicio,
        fin,
        selectedCronograma,
      );
      setValidationResult(validation);
    } else {
      setValidationResult(null);
    }
  }, [fechaInicio, fechaFin, selectedCronograma]);

  // Agregar nuevo rango de vacaciones al cronograma
  const handleAgregarRango = async () => {
    if (!selectedCronograma || !fechaInicio || !fechaFin) {
      toast.error("Por favor, complete todos los campos");
      return;
    }

    const inicio = parseISO(fechaInicio);
    const fin = parseISO(fechaFin);
    const validation = validarRangoVacaciones(inicio, fin, selectedCronograma);

    if (!validation.isValid) {
      toast.error(validation.errors[0]);
      return;
    }

    const { diasSolicitados, incluye_finde } = calcularDiasConFinDeSemana(
      inicio,
      fin,
    );
    const esFlexible =
      diasSolicitados <= 7 && selectedCronograma.diasFlexiblesUsados < 7;

    // Crear nuevo rango
    const nuevoRango: RangoVacaciones = {
      id: generarIdVacacion(false),
      scheduleId: selectedCronograma.id,
      personalId: selectedCronograma.personalId,
      fechaInicio,
      fechaFin,
      diasSolicitados,
      tipo: esFlexible ? "flexible" : "bloque",
      incluye_finde,
      estado: "activo",
      esAdelanto: false,
      reprogramadoPor: null,
      esinadId: null,
    };

    // Guardar el nuevo rango en el endpoint /api/ranges/ en el servidor y agregar mas campos necesarios como cronogramaId, personalId, etc.
    try {
      const payload = {
        id: nuevoRango.id,
        scheduleId: nuevoRango.scheduleId,
        personalId: nuevoRango.personalId,
        fechaInicio: nuevoRango.fechaInicio,
        fechaFin: nuevoRango.fechaFin,
        diasSolicitados: nuevoRango.diasSolicitados,
        tipo: nuevoRango.tipo,
        incluye_finde: nuevoRango.incluye_finde,
        estado: nuevoRango.estado,
        esAdelanto: nuevoRango.esAdelanto,
        reprogramadoPor: nuevoRango.reprogramadoPor,
        esinadId: nuevoRango.esinadId,
      };

      await apiFetch('/api/ranges', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      toast.error('No se pudo guardar el rango en el servidor');
    }

    // Actualizar cronograma
    const cronogramaActualizado: CronogramaVacaciones = {
      ...selectedCronograma,
      rangos: [...(Array.isArray(selectedCronograma.rangos) ? selectedCronograma.rangos : []), nuevoRango],
      diasFlexiblesUsados: esFlexible
        ? selectedCronograma.diasFlexiblesUsados + diasSolicitados
        : selectedCronograma.diasFlexiblesUsados,
      diasBloqueUsados: !esFlexible
        ? selectedCronograma.diasBloqueUsados + diasSolicitados
        : selectedCronograma.diasBloqueUsados,
    };

    // Actualizar estado
    const cronogramasActualizados = cronogramas.map((c) =>
      c.id === cronogramaActualizado.id ? cronogramaActualizado : c,
    );
    setCronogramas(cronogramasActualizados);
    localStorage.setItem(
      "cronogramas",
      JSON.stringify(cronogramasActualizados),
    );
    setSelectedCronograma(cronogramaActualizado);

    try {
      await apiFetch(`/api/schedules/${cronogramaActualizado.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          id: cronogramaActualizado.id,
          personalId: cronogramaActualizado.personalId,
          anioVacacional: cronogramaActualizado.anioVacacional,
          fechaInicioAnio: cronogramaActualizado.fechaInicioAnio,
          fechaFinAnio: cronogramaActualizado.fechaFinAnio,
          diasTotales: cronogramaActualizado.diasTotales,
          diasFlexiblesDisponibles: cronogramaActualizado.diasFlexiblesDisponibles,
          diasFlexiblesUsados: cronogramaActualizado.diasFlexiblesUsados,
          diasBloqueDisponibles: cronogramaActualizado.diasBloqueDisponibles,
          diasBloqueUsados: cronogramaActualizado.diasBloqueUsados,
          diasAdelanto: cronogramaActualizado.diasAdelanto,
          estado: cronogramaActualizado.estado,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      toast.error('No se pudo actualizar el cronograma en el servidor');
    }

    // Mostrar warnings si existen
    if (validation.warnings.length > 0) {
      validation.warnings.forEach((warning) => toast.warning(warning));
    }
    toast.success("Rango de vacaciones agregado exitosamente");

    // Limpiar formulario
    setFechaInicio("");
    setFechaFin("");
    setValidationResult(null);
  };

  // Eliminar un rango de vacaciones del cronograma y eliminar en VacationRanges y actualizar en VacationSchedules
  const handleEliminarRango = async (rangoId: string) => {
    if (!selectedCronograma) return;

    const rango = selectedCronograma.rangos.find((r) => r.id === rangoId);
    if (!rango) return;

    try {
      await apiFetch(`/api/ranges/${rangoId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      toast.error('No se pudo eliminar el rango en el servidor');
      return;
    }

    // Calcular nuevos contadores
    const nuevosRangos = selectedCronograma.rangos.filter(
      (r) => r.id !== rangoId,
    );

    let diasFlexiblesUsados = selectedCronograma.diasFlexiblesUsados;
    let diasBloqueUsados = selectedCronograma.diasBloqueUsados;
    let diasAdelanto = selectedCronograma.diasAdelanto || 0;
    let diasTotales = selectedCronograma.diasTotales;

    if (rango.tipo === "flexible") {
      diasFlexiblesUsados =
        selectedCronograma.diasFlexiblesUsados - rango.diasSolicitados;
    } else {
      diasBloqueUsados =
        selectedCronograma.diasBloqueUsados - rango.diasSolicitados;
    }

    // Si el rango eliminado es un adelanto, ajustar diasAdelanto y diasTotales
    if (rango.esAdelanto) {
      diasAdelanto = Math.max(0, diasAdelanto - rango.diasSolicitados);
      // Si ya no quedan días de adelanto, volver a los 30 días base
      if (diasAdelanto === 0) {
        diasTotales = 30;
      } else {
        diasTotales = Math.max(30, diasTotales - rango.diasSolicitados);
      }
    }

    const cronogramaActualizado: CronogramaVacaciones = {
      ...selectedCronograma,
      rangos: nuevosRangos,
      diasFlexiblesUsados,
      diasBloqueUsados,
      diasAdelanto,
      diasTotales,
    };

    const cronogramasActualizados = cronogramas.map((c) =>
      c.id === cronogramaActualizado.id ? cronogramaActualizado : c,
    );
    setCronogramas(cronogramasActualizados);
    localStorage.setItem(
      "cronogramas",
      JSON.stringify(cronogramasActualizados),
    );
    setSelectedCronograma(cronogramaActualizado);

    try {
      await apiFetch(`/api/schedules/${cronogramaActualizado.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          id: cronogramaActualizado.id,
          personalId: cronogramaActualizado.personalId,
          anioVacacional: cronogramaActualizado.anioVacacional,
          fechaInicioAnio: cronogramaActualizado.fechaInicioAnio,
          fechaFinAnio: cronogramaActualizado.fechaFinAnio,
          diasTotales: cronogramaActualizado.diasTotales,
          diasFlexiblesDisponibles: cronogramaActualizado.diasFlexiblesDisponibles,
          diasFlexiblesUsados: cronogramaActualizado.diasFlexiblesUsados,
          diasBloqueDisponibles: cronogramaActualizado.diasBloqueDisponibles,
          diasBloqueUsados: cronogramaActualizado.diasBloqueUsados,
          diasAdelanto: cronogramaActualizado.diasAdelanto,
          estado: cronogramaActualizado.estado,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      toast.error('No se pudo actualizar el cronograma en el servidor');
    }

    toast.success("Rango eliminado exitosamente");
  };















  

  // Función para manejar actualizaciones desde componentes hijos (AdelantoVacaciones, ReprogramacionVacaciones)
  const handleCronogramaActualizado = (
    cronogramaActualizado: CronogramaVacaciones,
  ) => {
    const cronogramasActualizados = cronogramas.map((c) =>
      c.id === cronogramaActualizado.id ? cronogramaActualizado : c,
    );
    setCronogramas(cronogramasActualizados);
    localStorage.setItem(
      "cronogramas",
      JSON.stringify(cronogramasActualizados),
    );
    setSelectedCronograma(cronogramaActualizado);
  };

  const diasDisponibles = selectedCronograma
    ? calcularDiasDisponibles(selectedCronograma)
    : null;
  const empleadoSeleccionado = personal.find(
    (p) => p.id === selectedPersonalId,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate("/home")}
              variant="ghost"
              size="icon"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-600 rounded-lg">
                <CalendarPlus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Registro de Cronograma de Vacaciones
                </h1>
                <p className="text-sm text-gray-500">
                  Programe las vacaciones del personal
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Formulario */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Seleccionar Personal</CardTitle>
                <CardDescription>
                  Seleccione el empleado para gestionar sus vacaciones
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="personal">Personal</Label>
                  <Select
                    value={selectedPersonalId}
                    onValueChange={setSelectedPersonalId}
                  >
                    <SelectTrigger>
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
                </div>

                {empleadoSeleccionado && selectedCronograma && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p>
                          <strong>Periodo vacacional:</strong>{" "}
                          {selectedCronograma.anioVacacional}
                        </p>
                        <p>
                          <strong>Desde:</strong>{" "}
                          {format(
                            parseISO(selectedCronograma.fechaInicioAnio),
                            "dd/MM/yyyy",
                            { locale: es },
                          )}
                        </p>
                        <p>
                          <strong>Hasta:</strong>{" "}
                          {format(
                            parseISO(selectedCronograma.fechaFinAnio),
                            "dd/MM/yyyy",
                            { locale: es },
                          )}
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {selectedCronograma && (
              <Card>
                <CardHeader>
                  <CardTitle>Agregar Rango de Vacaciones</CardTitle>
                  <CardDescription>
                    Seleccione las fechas para el periodo de vacaciones
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fechaInicio">Fecha Inicio</Label>
                      <Input
                        id="fechaInicio"
                        type="date"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                        min={selectedCronograma.fechaInicioAnio.split("T")[0]}
                        max={selectedCronograma.fechaFinAnio.split("T")[0]}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fechaFin">Fecha Fin</Label>
                      <Input
                        id="fechaFin"
                        type="date"
                        value={fechaFin}
                        onChange={(e) => setFechaFin(e.target.value)}
                        min={
                          fechaInicio ||
                          selectedCronograma.fechaInicioAnio.split("T")[0]
                        }
                        max={selectedCronograma.fechaFinAnio.split("T")[0]}
                      />
                    </div>
                  </div>

                  {fechaInicio && fechaFin && (
                    <div className="p-3 bg-blue-50 rounded-md text-sm">
                      <p className="font-medium text-blue-900">
                        Días solicitados:{" "}
                        {differenceInDays(
                          parseISO(fechaFin),
                          parseISO(fechaInicio),
                        ) + 1}
                      </p>
                    </div>
                  )}

                  {validationResult && validationResult.warnings.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1">
                          {validationResult.warnings.map((warning, idx) => (
                            <li key={idx}>{warning}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {validationResult && validationResult.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1">
                          {validationResult.errors.map((error, idx) => (
                            <li key={idx}>{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={handleAgregarRango}
                    className="w-full gap-2"
                    disabled={!validationResult || !validationResult.isValid}
                  >
                    <CalendarPlus className="w-4 h-4" />
                    Agregar Rango de Vacaciones
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Rangos Programados */}
            {selectedCronograma && Array.isArray(selectedCronograma.rangos) && selectedCronograma.rangos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Vacaciones Programadas</CardTitle>
                  <CardDescription>
                    {
                      selectedCronograma.rangos.filter(
                        (r) => (r.estado ?? "activo") === "activo",
                      ).length
                    }{" "}
                    {selectedCronograma.rangos.filter(
                      (r) => (r.estado ?? "activo") === "activo",
                    ).length === 1
                      ? "periodo programado"
                      : "periodos programados"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedCronograma.rangos
                      .filter((r) => (r.estado ?? "activo") === "activo")
                      .map((rango) => {
                        const linkedOriginals =
                          rango.reprogramadoDesde &&
                            rango.reprogramadoDesde.length > 0
                            ? rango.reprogramadoDesde
                              .map((id) =>
                                selectedCronograma.rangos.find(
                                  (r) => r.id === id,
                                ),
                              )
                              .filter(Boolean)
                            : [];

                        return (
                          <div
                            id={`rango-${rango.id}`}
                            key={rango.id}
                            className="flex items-start justify-between p-4 bg-gray-50 rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge
                                  variant={
                                    rango.tipo === "flexible"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {rango.tipo === "flexible"
                                    ? "Flexible"
                                    : "Bloque"}
                                </Badge>
                                {rango.estado === "reprogramado" && (
                                  <Badge variant="outline" className="ml-2">
                                    Reprogramado
                                    {linkedOriginals.length > 0 && (
                                      <span className="ml-2">
                                        de{" "}
                                        {linkedOriginals.map((o, idx) => (
                                          <button
                                            key={o!.id}
                                            onClick={() => {
                                              const el =
                                                document.getElementById(
                                                  `rango-${o!.id}`,
                                                );
                                              if (el)
                                                el.scrollIntoView({
                                                  behavior: "smooth",
                                                  block: "center",
                                                });
                                            }}
                                            className="underline ml-1 text-sm text-indigo-700"
                                            type="button"
                                          >
                                            {formatearRangoFechas(
                                              o!.fechaInicio,
                                              o!.fechaFin,
                                            )}
                                            {idx < linkedOriginals.length - 1
                                              ? ", "
                                              : ""}
                                          </button>
                                        ))}
                                      </span>
                                    )}
                                  </Badge>
                                )}
                                {rango.incluye_finde && (
                                  <Badge variant="outline">
                                    Incluye fin de semana
                                  </Badge>
                                )}
                              </div>
                              <p className="font-medium text-gray-900">
                                {formatearRangoFechas(
                                  rango.fechaInicio,
                                  rango.fechaFin,
                                )}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                ID: {rango.id}
                              </p>
                              <p className="text-sm text-gray-600">
                                {rango.diasSolicitados}{" "}
                                {rango.diasSolicitados === 1 ? "día" : "días"}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEliminarRango(rango.id)}
                              className={
                                rango.estado === "reprogramado"
                                  ? "text-gray-400 cursor-not-allowed"
                                  : "text-red-600 hover:text-red-700 hover:bg-red-50"
                              }
                              disabled={rango.estado === "reprogramado"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Panel Lateral - Resumen */}
          <div className="space-y-6">
            {diasDisponibles && empleadoSeleccionado && selectedCronograma && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Días Disponibles</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total</span>
                        <span className="text-2xl font-bold text-gray-900">
                          {diasDisponibles.total}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-blue-500"
                          style={{
                            width: `${(diasDisponibles.total / 30) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        de 30 días totales
                      </p>
                    </div>

                    <div className="pt-4 border-t space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Días Flexibles
                          </p>
                          <p className="text-xs text-gray-500">
                            Rangos de 1-7 días
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-blue-600">
                            {diasDisponibles.flexibles}
                          </p>
                          <p className="text-xs text-gray-500">de 7 días</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Días en Bloque
                          </p>
                          <p className="text-xs text-gray-500">
                            Rangos de 7+ días
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-green-600">
                            {diasDisponibles.bloque}
                          </p>
                          <p className="text-xs text-gray-500">de 23 días</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Adelanto de Vacaciones */}
                <AdelantoVacaciones
                  empleado={empleadoSeleccionado}
                  cronograma={selectedCronograma}
                  onAdelantoAgregado={handleCronogramaActualizado}
                />

                {/* Reprogramación de Vacaciones */}
                <ReprogramacionVacaciones
                  cronograma={selectedCronograma}
                  onReprogramacion={handleCronogramaActualizado}
                />

                <Card className="bg-indigo-50 border-indigo-200">
                  <CardHeader>
                    <CardTitle className="text-indigo-900 text-sm">
                      Recordatorios
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-indigo-800 space-y-2">
                    <div className="flex gap-2">
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>Los días flexibles pueden usarse en rangos de 1 día</p>
                    </div>
                    <div className="flex gap-2">
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        Los días en bloque requieren mínimo 7 días consecutivos
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        Seleccionar un viernes incluye automáticamente sábado y
                        domingo
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {!selectedPersonalId && (
              <Card>
                <CardContent className="pt-6 text-center text-gray-500">
                  <CalendarPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">
                    Seleccione un empleado para comenzar
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
