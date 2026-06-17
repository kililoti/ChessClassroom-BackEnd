import { supabaseAdmin } from '../config/supabase';

export const getEventosGlobalesUsuario = async (
  usuarioId: string,
  rol: string,
  anio: number,
  mes: number
) => {
  const fechaInicio = `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
  const ultimoDia   = new Date(anio, mes + 1, 0);
  const fechaFinStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(ultimoDia.getDate()).padStart(2, '0')}`;

  // ── Clases del usuario ────────────────────────────────────
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

  // ── Nombres de clases ─────────────────────────────────────
  const { data: clases } = await supabaseAdmin
    .from('clases')
    .select('id, nombre')
    .in('id', clasesIds);

  const nombrePorClase: Record<string, string> = {};
  (clases ?? []).forEach((c: any) => { nombrePorClase[c.id] = c.nombre; });

  // ── Eventos del calendario (existentes) ───────────────────
  const filtroFechas =
    `and(fecha_inicio.gte.${fechaInicio}T00:00:00,fecha_inicio.lte.${fechaFinStr}T23:59:59),` +
    `and(deadline.gte.${fechaInicio}T00:00:00,deadline.lte.${fechaFinStr}T23:59:59)`;

  let query = supabaseAdmin
    .from('eventos_calendario')
    .select('*')
    .in('clase_id', clasesIds)
    .or(filtroFechas);

  if (rol === 'profesor') {
    query = query.is('alumno_id', null);
  } else {
    query = query.eq('alumno_id', usuarioId);
  }

  const { data: eventosCalendario, error } = await query.order('fecha_inicio');
  if (error) throw new Error(error.message);

  const eventosBase = (eventosCalendario ?? []).map((e: any) => ({
    ...e,
    clase_nombre: nombrePorClase[e.clase_id] ?? 'Clase',
  }));

  // ── Torneos del mes ───────────────────────────────────────
  const { data: torneos } = await supabaseAdmin
    .from('torneos')
    .select('id, nombre, fecha_inicio, fecha_fin, clase_id')
    .in('clase_id', clasesIds)
    .not('fecha_inicio', 'is', null)
    .gte('fecha_inicio', `${fechaInicio}T00:00:00`)
    .lte('fecha_inicio', `${fechaFinStr}T23:59:59`);

  const eventosTorneos = (torneos ?? []).map((t: any) => ({
    id:            `torneo-${t.id}`,
    clase_id:      t.clase_id,
    alumno_id:     null,
    titulo:        t.nombre,
    tipo:          'torneo' as const,
    fecha_inicio:  t.fecha_inicio,
    fecha_fin:     t.fecha_fin ?? null,
    deadline:      null,
    se_repite:     false,
    rango_inicio:  null,
    rango_fin:     null,
    dias_semana:   null,
    origen_grupal: true,
    creado_en:     t.fecha_inicio,
    clase_nombre:  nombrePorClase[t.clase_id] ?? 'Clase',
  }));

  // ── Entregas de ejercicios del mes ────────────────────────
  const eventosEntregas: any[] = [];

  const { data: carpetas } = await supabaseAdmin
    .from('recursos_carpetas')
    .select('id, nombre, clase_id')
    .in('clase_id', clasesIds);

  if (carpetas?.length) {
    const carpetaMap = new Map(carpetas.map((c: any) => [c.id, { nombre: c.nombre, clase_id: c.clase_id }]));
    const carpetaIds = carpetas.map((c: any) => c.id);

    const { data: archivos } = await supabaseAdmin
      .from('recursos_archivos')
      .select('id, carpeta_id')
      .in('carpeta_id', carpetaIds);

    if (archivos?.length) {
      const archivoToCarpeta = new Map(archivos.map((a: any) => [a.id, a.carpeta_id]));
      const archivoIds = archivos.map((a: any) => a.id);

      const { data: ejercicios } = await supabaseAdmin
        .from('ejercicios')
        .select('fecha_entrega, archivo_id')
        .in('archivo_id', archivoIds)
        .not('fecha_entrega', 'is', null)
        .eq('asignado', true)
        .gte('fecha_entrega', `${fechaInicio}T00:00:00`)
        .lte('fecha_entrega', `${fechaFinStr}T23:59:59`);

      if (ejercicios?.length) {
        // Agrupar por (claseId, fecha) — una carpeta solo aparece una vez por día y clase
        const porClaseFecha = new Map<string, { claseId: string; fecha: string; carpetas: Set<string> }>();

        for (const ej of ejercicios as any[]) {
          const fecha      = (ej.fecha_entrega as string).substring(0, 10);
          const carpetaId  = archivoToCarpeta.get(ej.archivo_id);
          const carpetaInfo = carpetaId ? carpetaMap.get(carpetaId) : null;
          if (!carpetaInfo) continue;

          const key = `${carpetaInfo.clase_id}|${fecha}`;
          if (!porClaseFecha.has(key)) {
            porClaseFecha.set(key, { claseId: carpetaInfo.clase_id, fecha, carpetas: new Set() });
          }
          porClaseFecha.get(key)!.carpetas.add(carpetaInfo.nombre);
        }

        porClaseFecha.forEach(({ claseId, fecha, carpetas: carpetasSet }) => {
          eventosEntregas.push({
            id:            `entrega-${claseId}-${fecha}`,
            clase_id:      claseId,
            alumno_id:     null,
            titulo:        'Deberes',
            descripcion:   Array.from(carpetasSet).join(', '),
            tipo:          'deberes' as const,
            fecha_inicio:  fecha,
            fecha_fin:     null,
            deadline:      fecha,
            se_repite:     false,
            rango_inicio:  null,
            rango_fin:     null,
            dias_semana:   null,
            origen_grupal: true,
            creado_en:     fecha,
            clase_nombre:  nombrePorClase[claseId] ?? 'Clase',
          });
        });
      }
    }
  }

  // ── Merge y ordenar por fecha ─────────────────────────────
  return [...eventosBase, ...eventosTorneos, ...eventosEntregas]
    .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
};