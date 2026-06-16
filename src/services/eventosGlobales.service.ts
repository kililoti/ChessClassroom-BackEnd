import { supabaseAdmin } from '../config/supabase';

export const getEventosGlobalesUsuario = async (
  usuarioId: string,
  rol: string,
  anio: number,
  mes: number
) => {
  // Primer y último día del mes
  const fechaInicio = `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
  const ultimoDia   = new Date(anio, mes + 1, 0);
  const fechaFinStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(ultimoDia.getDate()).padStart(2, '0')}`;

  // Obtener clases del usuario
  let clasesIds: string[] = [];

  if (rol === 'profesor') {
    const { data: clases } = await supabaseAdmin
      .from('clase_profesores')
      .select('clase_id')
      .eq('profesor_id', usuarioId);
    clasesIds = (clases ?? []).map((c: any) => c.clase_id);
  } else {
    const { data: clases } = await supabaseAdmin
      .from('clase_alumnos')
      .select('clase_id')
      .eq('alumno_id', usuarioId);
    clasesIds = (clases ?? []).map((c: any) => c.clase_id);
  }

  if (clasesIds.length === 0) return [];

  // Obtener nombres de clases
  const { data: clases } = await supabaseAdmin
    .from('clases')
    .select('id, nombre')
    .in('id', clasesIds);

  const nombrePorClase: Record<string, string> = {};
  (clases ?? []).forEach((c: any) => { nombrePorClase[c.id] = c.nombre; });

  // ── Filtro de fechas ─────────────────────────────────────
  // Queremos eventos donde (fecha_inicio O deadline) caen dentro del mes.
  // PostgREST no permite encadenar dos .or() — hay que combinarlo en uno solo
  // usando and() agrupados dentro del or():
  //   (fecha_inicio >= inicio AND fecha_inicio <= fin)
  //   OR
  //   (deadline >= inicio AND deadline <= fin)
  const filtroFechas =
    `and(fecha_inicio.gte.${fechaInicio}T00:00:00,fecha_inicio.lte.${fechaFinStr}T23:59:59),` +
    `and(deadline.gte.${fechaInicio}T00:00:00,deadline.lte.${fechaFinStr}T23:59:59)`;

  let query = supabaseAdmin
    .from('eventos_calendario')
    .select('*')
    .in('clase_id', clasesIds)
    .or(filtroFechas);

  if (rol === 'profesor') {
    query = query.is('alumno_id', null); // solo referencias grupales
  } else {
    query = query.eq('alumno_id', usuarioId); // solo los suyos
  }

  const { data: eventos, error } = await query.order('fecha_inicio');
  if (error) throw new Error(error.message);

  // Añadir nombre de clase a cada evento
  return (eventos ?? []).map((e: any) => ({
    ...e,
    clase_nombre: nombrePorClase[e.clase_id] ?? 'Clase',
  }));
};