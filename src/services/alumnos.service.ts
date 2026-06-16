import { supabaseAdmin } from '../config/supabase';
 
// ── Alumnos con alias ─────────────────────────────────────
 
/**
 * Reemplaza el getAlumnos existente para incluir alias.
 * Asegúrate de sustituir o actualizar la función getAlumnos en clase.service.ts
 */
export const getAlumnos = async (claseId: string) => {
  const { data, error } = await supabaseAdmin
    .from('clase_alumnos')
    .select(`
      alumno_id,
      alias,
      fecha_inscripcion,
      usuarios!clase_alumnos_alumno_id_fkey (
        nombre,
        apellidos
      )
    `)
    .eq('clase_id', claseId)
    .order('fecha_inscripcion');
 
  if (error) throw new Error(error.message);
 
  // Aplanar la respuesta para que el frontend reciba un objeto limpio
  return (data ?? []).map((row: any) => ({
    alumno_id: row.alumno_id,
    nombre: row.usuarios?.nombre ?? '',
    apellidos: row.usuarios?.apellidos ?? '',
    alias: row.alias ?? null,
    fecha_inscripcion: row.fecha_inscripcion,
  }));
};
 
/**
 * Actualiza el alias de un alumno dentro de una clase.
 * alias=null elimina el alias y vuelve a mostrar el nombre real.
 */
export const actualizarAlias = async (
  claseId: string,
  alumnoId: string,
  alias: string | null,
) => {
  const { data, error } = await supabaseAdmin
    .from('clase_alumnos')
    .update({ alias })
    .eq('clase_id', claseId)
    .eq('alumno_id', alumnoId)
    .select()
    .single();
 
  if (error) throw new Error(error.message);
  return data;
};
 
/**
 * Elimina al alumno de la clase (no borra su cuenta).
 * También limpia sus eventos y rutinas asociados a la clase.
 */
export const expulsarAlumno = async (claseId: string, alumnoId: string) => {
  // 1. Eliminar eventos del alumno en esta clase
  await supabaseAdmin
    .from('eventos_calendario')
    .delete()
    .eq('clase_id', claseId)
    .eq('alumno_id', alumnoId);
 
  // 2. Eliminar rutinas del alumno en esta clase
  const { data: rutinas } = await supabaseAdmin
    .from('rutinas_checklist')
    .select('id')
    .eq('clase_id', claseId)
    .eq('alumno_id', alumnoId);
 
  if (rutinas && rutinas.length > 0) {
    const rutinaIds = rutinas.map((r: { id: string }) => r.id);
    await supabaseAdmin
      .from('rutinas_checklist_semanas')
      .delete()
      .in('rutina_id', rutinaIds);
 
    await supabaseAdmin
      .from('rutinas_checklist')
      .delete()
      .eq('clase_id', claseId)
      .eq('alumno_id', alumnoId);
  }
 
  // 3. Eliminar de la clase
  const { error } = await supabaseAdmin
    .from('clase_alumnos')
    .delete()
    .eq('clase_id', claseId)
    .eq('alumno_id', alumnoId);
 
  if (error) throw new Error(error.message);
};