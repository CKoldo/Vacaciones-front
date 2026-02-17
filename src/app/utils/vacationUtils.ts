import { 
  differenceInDays, 
  differenceInMonths,
  addDays, 
  isFriday, 
  isSaturday, 
  isSunday,
  isWeekend,
  addYears,
  format,
  parseISO,
  startOfDay,
  isAfter,
  eachDayOfInterval
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { CronogramaVacaciones, RangoVacaciones, VacationValidation } from '@/app/types';
import { generateUuid } from '@/app/utils/id';

/**
 * Calcula cuántos años ha trabajado una persona
 */
export function calcularAniosTrabajados(fechaIngreso: string): number {
  const ingreso = parseISO(fechaIngreso);
  const hoy = new Date();
  const diff = differenceInDays(hoy, ingreso);
  return Math.floor(diff / 365);
}

/**
 * Calcula el periodo vacacional para un empleado
 */
export function calcularPeriodoVacacional(fechaIngreso: string): {
  anioVacacional: string;
  fechaInicio: string;
  fechaFin: string;
} {
  const ingreso = parseISO(fechaIngreso);
  const inicioVacaciones = addYears(ingreso, 1); // después de 1 año
  const finVacaciones = addYears(inicioVacaciones, 1);
  
  return {
    anioVacacional: `${format(inicioVacaciones, 'yyyy', { locale: es })}-${format(finVacaciones, 'yyyy', { locale: es })}`,
    fechaInicio: inicioVacaciones.toISOString(),
    fechaFin: finVacaciones.toISOString(),
  };
}

/**
 * Verifica si una fecha es viernes
 */
export function esViernes(fecha: Date): boolean {
  return isFriday(fecha);
}

/**
 * Calcula los días reales incluyendo fines de semana si empieza o termina en viernes
 */
export function calcularDiasConFinDeSemana(fechaInicio: Date, fechaFin: Date): {
  diasSolicitados: number;
  incluye_finde: boolean;
} {
  const dias = differenceInDays(fechaFin, fechaInicio) + 1; // +1 para incluir el día final
  const iniciaEnViernes = esViernes(fechaInicio);
  const terminaEnViernes = esViernes(fechaFin);
  const incluye_finde = iniciaEnViernes || terminaEnViernes;
  
  if (incluye_finde) {
    // Si empieza o termina en viernes, automáticamente se incluyen sábado y domingo
    return {
      diasSolicitados: dias,
      incluye_finde: true,
    };
  }
  
  return {
    diasSolicitados: dias,
    incluye_finde: false,
  };
}

/**
 * Cuenta cuántos días hábiles hay en un rango
 */
export function contarDiasHabiles(fechaInicio: Date, fechaFin: Date): number {
  const allDays = eachDayOfInterval({ start: fechaInicio, end: fechaFin });
  return allDays.filter(day => !isWeekend(day)).length;
}

/**
 * Valida un rango de vacaciones según las reglas de negocio
 */
export function validarRangoVacaciones(
  fechaInicio: Date,
  fechaFin: Date,
  cronograma: CronogramaVacaciones,
  esNuevoRango: boolean = true
): VacationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Verificar que las fechas están dentro del periodo vacacional
  const inicioAnio = parseISO(cronograma.fechaInicioAnio);
  const finAnio = parseISO(cronograma.fechaFinAnio);
  
  if (fechaInicio < inicioAnio || fechaInicio > finAnio) {
    errors.push(`La fecha de inicio debe estar entre ${format(inicioAnio, 'dd/MM/yyyy', { locale: es })} y ${format(finAnio, 'dd/MM/yyyy', { locale: es })}`);
  }
  
  if (fechaFin < inicioAnio || fechaFin > finAnio) {
    errors.push(`La fecha de fin debe estar entre ${format(inicioAnio, 'dd/MM/yyyy', { locale: es })} y ${format(finAnio, 'dd/MM/yyyy', { locale: es })}`);
  }
  
  if (fechaInicio > fechaFin) {
    errors.push('La fecha de inicio no puede ser posterior a la fecha de fin');
  }
  
  // Validar que la fecha de inicio no sea fin de semana
  if (isSaturday(fechaInicio) || isSunday(fechaInicio)) {
    errors.push('No se puede iniciar una vacación en fin de semana (sábado o domingo)');
  }
  
  // Calcular días solicitados
  const { diasSolicitados, incluye_finde } = calcularDiasConFinDeSemana(fechaInicio, fechaFin);
  
  // Advertencia si selecciona viernes como fecha de inicio o fin
  if (esViernes(fechaInicio)) {
    warnings.push('⚠️ Al seleccionar un viernes como inicio, se incluyen automáticamente el sábado y domingo');
  }
  
  if (esViernes(fechaFin)) {
    warnings.push('⚠️ Al seleccionar un viernes como fin, se extiende automáticamente hasta el domingo');
  }
  
  // Verificar tipo de rango (flexible vs bloque)
  const diasFlexiblesRestantes = cronograma.diasFlexiblesDisponibles - cronograma.diasFlexiblesUsados;
  const diasBloqueRestantes = cronograma.diasBloqueDisponibles - cronograma.diasBloqueUsados;
  
  if (diasSolicitados <= 7) {
    // Es un rango flexible
    if (diasFlexiblesRestantes === 0) {
      errors.push('Ya has utilizado todos tus días flexibles (7 días). Los días restantes deben solicitarse en bloques de mínimo 7 días');
    } else if (diasSolicitados > diasFlexiblesRestantes) {
      errors.push(`Solo te quedan ${diasFlexiblesRestantes} días flexibles disponibles`);
    }
    
    // Advertencia si está por completar los días flexibles
    if (diasFlexiblesRestantes - diasSolicitados === 0 && diasFlexiblesRestantes > 0) {
      warnings.push(`Con este rango completarás tus ${cronograma.diasFlexiblesDisponibles} días flexibles. Los días restantes deberán solicitarse en bloques de mínimo 7 días`);
    }
  } else {
    // Es un bloque (más de 7 días)
    if (diasSolicitados > diasBloqueRestantes) {
      errors.push(`Solo te quedan ${diasBloqueRestantes} días en bloque disponibles`);
    }
  }
  
  // Verificar solapamiento con otros rangos
  if (esNuevoRango) {
    for (const rango of Array.isArray(cronograma.rangos) ? cronograma.rangos : []) {
      const rangoInicio = parseISO(rango.fechaInicio);
      const rangoFin = parseISO(rango.fechaFin);
      
      if (
        (fechaInicio >= rangoInicio && fechaInicio <= rangoFin) ||
        (fechaFin >= rangoInicio && fechaFin <= rangoFin) ||
        (fechaInicio <= rangoInicio && fechaFin >= rangoFin)
      ) {
        errors.push('Este rango se solapa con vacaciones ya programadas');
        break;
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calcula los días totales disponibles
 */
export function calcularDiasDisponibles(cronograma: CronogramaVacaciones): {
  flexibles: number;
  bloque: number;
  total: number;
} {
  const flexibles = cronograma.diasFlexiblesDisponibles - cronograma.diasFlexiblesUsados;
  const bloque = cronograma.diasBloqueDisponibles - cronograma.diasBloqueUsados;
  
  return {
    flexibles: Math.max(0, flexibles),
    bloque: Math.max(0, bloque),
    total: Math.max(0, flexibles + bloque),
  };
}

/**
 * Formatea un rango de fechas
 */
export function formatearRangoFechas(fechaInicio: string, fechaFin: string): string {
  // Evita desfase de días por zona horaria y errores de fecha inválida
  function parseLocal(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== "string") return null;
    const normalized = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
    const parts = normalized.split("-");
    if (parts.length !== 3) return null;
    const [yearStr, monthStr, dayStr] = parts;
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return new Date(year, month - 1, day);
  }
  const inicio = parseLocal(fechaInicio);
  const fin = parseLocal(fechaFin);
  if (!inicio || isNaN(inicio.getTime()) || !fin || isNaN(fin.getTime())) {
    return "Fecha inválida";
  }
  return `${format(inicio, 'dd/MM/yyyy', { locale: es })} - ${format(fin, 'dd/MM/yyyy', { locale: es })}`;
}

/**
 * Calcula los días de adelanto disponibles según meses trabajados
 * 2.5 días por mes trabajado
 */
export function calcularDiasAdelantoDisponibles(fechaIngreso: string): number {
  const ingreso = parseISO(fechaIngreso);
  const hoy = new Date();
  const mesesTrabajados = differenceInDays(hoy, ingreso) / 30.44; // Promedio días por mes
  const diasAdelanto = Math.floor(mesesTrabajados * 2.5);
  
  // Máximo 30 días (un año completo = 12 meses = 30 días)
  return Math.min(diasAdelanto, 30);
}

/**
 * Calcula los días de adelanto disponibles dentro del periodo vacacional hasta la fecha actual.
 * Se considera 2.5 días por mes completado desde el inicio del periodo.
 */
export function calcularDiasAdelantoDisponiblesEnPeriodo(fechaInicioAnio: string): number {
  const inicio = parseISO(fechaInicioAnio);
  const hoy = new Date();
  if (hoy <= inicio) return 0;

  const mesesCompletos = differenceInMonths(hoy, inicio);
  const dias = mesesCompletos * 2.5;
  // No permitir más de 30 días
  return Math.min(dias, 30);
}

/**
 * Verifica si un rango puede ser reprogramado
 * Solo se pueden reprogramar rangos cuya fecha de inicio es posterior a hoy
 */
export function puedeReprogramar(fechaInicio: string): boolean {
  const inicio = parseISO(fechaInicio);
  const hoyInicio = startOfDay(new Date());
  // Solo permitir reprogramar si la fecha de inicio es posterior al inicio del día actual
  return isAfter(inicio, hoyInicio);
}

/**
 * Genera un ID único con formato UUID para compatibilidad con Supabase.
 */
export function generarIdVacacion(_esReprogramada: boolean = false): string {
  return generateUuid();
}

/**
 * Verifica si dos rangos de fechas se solapan
 */
export function verificarSolapamiento(
  fechaInicio1: Date,
  fechaFin1: Date,
  fechaInicio2: Date,
  fechaFin2: Date
): boolean {
  return (
    (fechaInicio1 >= fechaInicio2 && fechaInicio1 <= fechaFin2) ||
    (fechaFin1 >= fechaInicio2 && fechaFin1 <= fechaFin2) ||
    (fechaInicio1 <= fechaInicio2 && fechaFin1 >= fechaFin2)
  );
}

/**
 * Busca solapamientos entre nuevos rangos de fechas y los rangos existentes
 * Puede excluir IDs específicos (útil para reprogramación)
 */
export function buscarSolapamientos(
  nuevasParechas: Array<{ inicio: string; fin: string }>,
  cronograma: CronogramaVacaciones,
  idsAExcluir: string[] = []
): string | null {
  for (const nuevaFecha of nuevasParechas) {
    const nuevoInicio = parseISO(nuevaFecha.inicio);
    const nuevoFin = parseISO(nuevaFecha.fin);

    for (const rango of cronograma.rangos) {
      // Excluir rangos que están siendo reprogramados
      if (idsAExcluir.includes(rango.id)) continue;
      // Excluir rangos ya reprogramados
      if ((rango.estado ?? 'activo') !== 'activo') continue;

      const rangoInicio = parseISO(rango.fechaInicio);
      const rangoFin = parseISO(rango.fechaFin);

      if (verificarSolapamiento(nuevoInicio, nuevoFin, rangoInicio, rangoFin)) {
        return `Solapamiento detectado con el rango ${formatearRangoFechas(rango.fechaInicio, rango.fechaFin)}`;
      }
    }
  }

  return null;
}