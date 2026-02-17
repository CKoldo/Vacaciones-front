export interface User {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'user';
}

export interface Personal {
  id: string;
  nombre: string;
  apellido: string;
  fechaIngreso: string; // ISO date string
  email: string;
  puesto: string;
}

export interface RangoVacaciones {
  id: string;
  scheduleId?: string;
  personalId?: string;
  fechaInicio: string; // ISO date string
  fechaFin: string; // ISO date string
  diasSolicitados: number;
  tipo: 'flexible' | 'bloque'; // flexible = 1-7 días, bloque = 7+ días
  incluye_finde?: boolean; // si incluye fin de semana por seleccionar viernes
  estado?: 'activo' | 'reprogramado'; // estado del rango
  esAdelanto?: boolean; // si es un adelanto de vacaciones
  reprogramadoDesde?: string[]; // IDs de rangos que fueron reprogramados para crear este
  reprogramadoPor?: string | null; // ID del nuevo rango que reprogramó este rango (si aplica)
  esinadId?: string | null; // ID del documento ESINAD vinculado
}

export interface CronogramaVacaciones {
  id: string;
  personalId: string;
  anioVacacional: string; // ej: "2026-2027"
  fechaInicioAnio: string; // cuando puede empezar a tomar vacaciones
  fechaFinAnio: string; // cuando termina el periodo
  diasTotales: number; // siempre 30
  diasFlexiblesDisponibles: number; // máximo 7 días
  diasFlexiblesUsados: number;
  diasBloqueDisponibles: number; // 23 días restantes
  diasBloqueUsados: number;
  diasAdelanto: number; // días usados por adelanto que se restan de este periodo
  rangos: RangoVacaciones[];
  estado: 'pendiente' | 'aprobado' | 'rechazado';
}

export interface VacationValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}