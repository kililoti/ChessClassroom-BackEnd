export interface RegistroUsuarioDTO {
  email: string;
  password?: string; // Opcional si se usa OAuth en el futuro
  nombre: string;
  apellidos: string;
  rol: 'profesor' | 'alumno';
}

export interface LoginUsuarioDTO {
  email: string;
  password?: string;
}

export type TipoClase = 'grupal' | 'particular';

export interface Clase {
  id: string;
  nombre: string;
  descripcion?: string;
  tipo: TipoClase;
  codigo_invitacion: string;
  activo: boolean;
  created_at: string;
}

export interface ClaseProfesor {
  clase_id: string;
  profesor_id: string;
  fecha_asignacion: string;
}

export interface ClaseAlumno {
  clase_id: string;
  alumno_id: string;
  fecha_inscripcion: string;
}