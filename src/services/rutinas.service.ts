import { supabaseAdmin } from '../config/supabase';
 
// ── Helpers ───────────────────────────────────────────────
 
const getLunes = (fecha: Date): string => {
  const d = new Date(fecha);
  const dia = d.getDay();
  const diff = d.getDate() - dia + (dia === 0 ? -6 : 1);
  d.setDate(diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
 
/**
 * Devuelve los lunes de todas las semanas que tienen al menos un día dentro del mes dado.
 * Por ejemplo, para junio 2026 devuelve los lunes del 1-jun al 28-jun (o el lunes antes si el mes no empieza en lunes).
 */
const getLunesDelMes = (anio: number, mes: number): string[] => {
  const lunes = new Set<string>();
 
  // Primer y último día del mes
  const primerDia = new Date(anio, mes, 1);
  const ultimoDia = new Date(anio, mes + 1, 0);
 
  // Iteramos cada día del mes y calculamos su lunes de semana
  const actual = new Date(primerDia);
  while (actual <= ultimoDia) {
    lunes.add(getLunes(new Date(actual)));
    actual.setDate(actual.getDate() + 1);
  }
 
  return Array.from(lunes).sort();
};
 
// ── Checklist ─────────────────────────────────────────────
 
/**
 * Obtiene las rutinas de un alumno con los datos de semana.
 *
 * - Si se pasa `semanaInicio`: carga solo esa semana (usado por el checklist lateral).
 * - Si se pasa `mesAnio` ("YYYY-MM"): carga TODAS las semanas del mes (usado por el calendario mensual para los ticks).
 * - Si no se pasa nada: usa la semana actual.
 */
export const getChecklist = async (
  claseId: string,
  alumnoId?: string,
  semanaInicio?: string,
  mesAnio?: string,   // nuevo parámetro: "YYYY-MM"
) => {
  // Vista grupo completo → rutinas de referencia sin datos de semana
  if (!alumnoId) {
    const { data, error } = await supabaseAdmin
      .from('rutinas_checklist')
      .select('*')
      .eq('clase_id', claseId)
      .is('alumno_id', null);
    if (error) throw new Error(error.message);
    return data;
  }
 
  // Calcular qué semanas hay que cargar
  let semanas: string[];
 
  if (mesAnio) {
    // mesAnio = "2026-06"
    const [y, m] = mesAnio.split('-').map(Number);
    semanas = getLunesDelMes(y, m - 1); // mes en JS es 0-indexed
  } else {
    semanas = [semanaInicio ?? getLunes(new Date())];
  }
 
  // Obtener rutinas del alumno
  const { data: rutinas, error } = await supabaseAdmin
    .from('rutinas_checklist')
    .select('*')
    .eq('clase_id', claseId)
    .eq('alumno_id', alumnoId);
 
  if (error) throw new Error(error.message);
  if (!rutinas || rutinas.length === 0) return [];
 
  // Si cargamos un mes completo: devolvemos una entrada por rutina×semana
  // Si cargamos una sola semana: devolvemos una entrada por rutina (con .semana)
  if (mesAnio) {
    // Para el calendario necesitamos saber el estado de cada semana:
    // devolvemos todas las combinaciones rutina×semana que existan + creamos las que falten
    const resultado: any[] = [];
 
    for (const semana of semanas) {
      const rutinasConSemana = await Promise.all(
        rutinas.map(async (r) => {
          let { data: semanaData } = await supabaseAdmin
            .from('rutinas_checklist_semanas')
            .select('*')
            .eq('rutina_id', r.id)
            .eq('alumno_id', alumnoId)
            .eq('semana_inicio', semana)
            .single();
 
          if (!semanaData) {
            const { data: nueva } = await supabaseAdmin
              .from('rutinas_checklist_semanas')
              .insert({ rutina_id: r.id, alumno_id: alumnoId, semana_inicio: semana })
              .select()
              .single();
            semanaData = nueva;
          }
 
          return { ...r, semana: semanaData };
        })
      );
      resultado.push(...rutinasConSemana);
    }
 
    return resultado;
  }
 
  // Semana única (checklist lateral)
  const lunes = semanas[0];
  const rutinasConSemana = await Promise.all(
    rutinas.map(async (r) => {
      let { data: semanaData } = await supabaseAdmin
        .from('rutinas_checklist_semanas')
        .select('*')
        .eq('rutina_id', r.id)
        .eq('alumno_id', alumnoId)
        .eq('semana_inicio', lunes)
        .single();
 
      if (!semanaData) {
        const { data: nueva } = await supabaseAdmin
          .from('rutinas_checklist_semanas')
          .insert({ rutina_id: r.id, alumno_id: alumnoId, semana_inicio: lunes })
          .select()
          .single();
        semanaData = nueva;
      }
 
      return { ...r, semana: semanaData };
    })
  );
 
  return rutinasConSemana;
};
 
export const crearRutina = async (dto: {
  clase_id: string;
  alumno_id: string | null;
  titulo: string;
  creado_por: string;
}) => {
  if (!dto.alumno_id) {
    const { data: ref, error: errorRef } = await supabaseAdmin
      .from('rutinas_checklist')
      .insert({ ...dto, alumno_id: null, origen_grupal: true })
      .select()
      .single();
 
    if (errorRef) throw new Error(errorRef.message);
 
    const { data: alumnos } = await supabaseAdmin
      .from('clase_alumnos')
      .select('alumno_id')
      .eq('clase_id', dto.clase_id);
 
    if (alumnos && alumnos.length > 0) {
      const copias = alumnos.map((a: { alumno_id: string }) => ({
        ...dto, alumno_id: a.alumno_id, origen_grupal: true,
      }));
      const { error } = await supabaseAdmin.from('rutinas_checklist').insert(copias);
      if (error) throw new Error(error.message);
    }
 
    return ref;
  }
 
  const { data, error } = await supabaseAdmin
    .from('rutinas_checklist')
    .insert({ ...dto, origen_grupal: false })
    .select()
    .single();
 
  if (error) throw new Error(error.message);
  return data;
};
 
export const eliminarRutina = async (rutinaId: string) => {
  const { data: rutina } = await supabaseAdmin
    .from('rutinas_checklist')
    .select('clase_id, titulo, origen_grupal, alumno_id')
    .eq('id', rutinaId)
    .single();
 
  if (!rutina) throw new Error('Rutina no encontrada');
 
  if (rutina.origen_grupal && rutina.alumno_id === null) {
    const { error } = await supabaseAdmin
      .from('rutinas_checklist')
      .delete()
      .eq('clase_id', rutina.clase_id)
      .eq('titulo', rutina.titulo)
      .eq('origen_grupal', true);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin
      .from('rutinas_checklist')
      .delete()
      .eq('id', rutinaId);
    if (error) throw new Error(error.message);
  }
};
 
export const toggleSemana = async (semanaId: string) => {
  const { data: semana, error: fetchError } = await supabaseAdmin
    .from('rutinas_checklist_semanas')
    .select('completado')
    .eq('id', semanaId)
    .single();
 
  if (fetchError) throw new Error(fetchError.message);
 
  const nuevoEstado = !semana.completado;
 
  const { data, error } = await supabaseAdmin
    .from('rutinas_checklist_semanas')
    .update({
      completado: nuevoEstado,
      completado_en: nuevoEstado ? new Date().toISOString() : null,
    })
    .eq('id', semanaId)
    .select()
    .single();
 
  if (error) throw new Error(error.message);
  return data;
};
 
// ── Notificaciones ────────────────────────────────────────
 
export const getNotificaciones = async (usuarioId: string) => {
  const { data, error } = await supabaseAdmin
    .from('notificaciones')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false })
    .limit(50);
 
  if (error) throw new Error(error.message);
  return data;
};
 
export const marcarLeida = async (notificacionId: string) => {
  const { data, error } = await supabaseAdmin
    .from('notificaciones')
    .update({ leida: true })
    .eq('id', notificacionId)
    .select()
    .single();
 
  if (error) throw new Error(error.message);
  return data;
};
 
export const marcarTodasLeidas = async (usuarioId: string) => {
  const { error } = await supabaseAdmin
    .from('notificaciones')
    .update({ leida: true })
    .eq('usuario_id', usuarioId)
    .eq('leida', false);
 
  if (error) throw new Error(error.message);
};
 
export const crearNotificacion = async (dto: {
  usuario_id: string;
  titulo: string;
  mensaje: string;
  tipo: 'clase' | 'torneo' | 'deberes' | 'rutina';
  evento_id?: string | null;
}) => {
  const { error } = await supabaseAdmin.from('notificaciones').insert(dto);
  if (error) throw new Error(error.message);
};