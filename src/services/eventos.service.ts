import { supabaseAdmin } from '../config/supabase';

export const getEventos = async (claseId: string, alumnoId?: string) => {
  if (alumnoId) {
    const { data, error } = await supabaseAdmin
      .from('eventos_calendario')
      .select('*')
      .eq('clase_id', claseId)
      .eq('alumno_id', alumnoId)
      .order('fecha_inicio');
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabaseAdmin
    .from('eventos_calendario')
    .select('*')
    .eq('clase_id', claseId)
    .is('alumno_id', null)
    .order('fecha_inicio');
  if (error) throw new Error(error.message);
  return data;
};

export const crearEvento = async (dto: {
  clase_id: string;
  alumno_id: string | null;
  titulo: string;
  tipo: 'clase' | 'torneo' | 'deberes';
  fecha_inicio: string;
  fecha_fin?: string | null;
  deadline?: string | null;
  se_repite: boolean;
  rango_inicio?: string | null;
  rango_fin?: string | null;
  dias_semana?: number[] | null;
  creado_por: string;
}) => {
  // Generar un grupo_id para agrupar eventos repetidos
  const grupo_repeticion_id = dto.se_repite
    ? crypto.randomUUID()
    : null;

  if (dto.se_repite && dto.dias_semana && dto.rango_inicio && dto.rango_fin) {
    const eventos = generarEventosRepetidos(dto);

    if (!dto.alumno_id) {
      const { data: alumnos } = await supabaseAdmin
        .from('clase_alumnos')
        .select('alumno_id')
        .eq('clase_id', dto.clase_id);

      const eventosReferencia = eventos.map(e => ({
        ...e, alumno_id: null, origen_grupal: true, grupo_repeticion_id
      }));
      const eventosAlumnos = (alumnos ?? []).flatMap((a: { alumno_id: string }) =>
        eventos.map(e => ({
          ...e, alumno_id: a.alumno_id, origen_grupal: true, grupo_repeticion_id
        }))
      );

      const { error } = await supabaseAdmin
        .from('eventos_calendario')
        .insert([...eventosReferencia, ...eventosAlumnos]);
      if (error) throw new Error(error.message);
      return { creados: eventosReferencia.length + eventosAlumnos.length };
    }

    const { error } = await supabaseAdmin
      .from('eventos_calendario')
      .insert(eventos.map(e => ({
        ...e, alumno_id: dto.alumno_id, origen_grupal: false, grupo_repeticion_id
      })));
    if (error) throw new Error(error.message);
    return { creados: eventos.length };
  }

  // Evento puntual
  if (!dto.alumno_id) {
    const { data: alumnos } = await supabaseAdmin
      .from('clase_alumnos')
      .select('alumno_id')
      .eq('clase_id', dto.clase_id);

    const referencia = { ...dto, alumno_id: null, origen_grupal: true, grupo_repeticion_id };
    const copias = (alumnos ?? []).map((a: { alumno_id: string }) => ({
      ...dto, alumno_id: a.alumno_id, origen_grupal: true, grupo_repeticion_id
    }));

    const { error } = await supabaseAdmin
      .from('eventos_calendario')
      .insert([referencia, ...copias]);
    if (error) throw new Error(error.message);
    return { creado: true };
  }

  const { data, error } = await supabaseAdmin
    .from('eventos_calendario')
    .insert({ ...dto, origen_grupal: false, grupo_repeticion_id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

// soloEste: true = solo este evento, false = todos los del grupo
// desdeGrupo: true = se borra desde vista grupo completo (afecta a todos los alumnos)
export const eliminarEvento = async (
  eventoId: string,
  soloEste: boolean,
  desdeGrupo: boolean
) => {
  const { data: evento, error: errorEvento } = await supabaseAdmin
    .from('eventos_calendario')
    .select('clase_id, titulo, tipo, origen_grupal, alumno_id, grupo_repeticion_id')
    .eq('id', eventoId)
    .single();

  if (errorEvento || !evento) throw new Error('Evento no encontrado');

  if (desdeGrupo && evento.origen_grupal) {
    // Borrar desde grupo completo → borra referencia + copias de alumnos
    if (!soloEste && evento.grupo_repeticion_id) {
      // Borrar todos los días del grupo de repetición para todos
      const { error } = await supabaseAdmin
        .from('eventos_calendario')
        .delete()
        .eq('grupo_repeticion_id', evento.grupo_repeticion_id);
      if (error) throw new Error(error.message);
    } else {
      // Borrar solo este día para todos (referencia + copias de alumnos con misma fecha)
      const fechaEvento = evento.titulo; // usamos título+tipo para identificar el día exacto
      const { data: mismoDia } = await supabaseAdmin
        .from('eventos_calendario')
        .select('id')
        .eq('clase_id', evento.clase_id)
        .eq('titulo', evento.titulo)
        .eq('tipo', evento.tipo)
        .eq('origen_grupal', true);

      // Filtrar los que tienen la misma fecha_inicio
      const { data: eventoCompleto } = await supabaseAdmin
        .from('eventos_calendario')
        .select('fecha_inicio')
        .eq('id', eventoId)
        .single();

      if (eventoCompleto) {
        const { error } = await supabaseAdmin
          .from('eventos_calendario')
          .delete()
          .eq('clase_id', evento.clase_id)
          .eq('titulo', evento.titulo)
          .eq('tipo', evento.tipo)
          .eq('origen_grupal', true)
          .eq('fecha_inicio', eventoCompleto.fecha_inicio);
        if (error) throw new Error(error.message);
      }
    }
  } else if (!soloEste && evento.grupo_repeticion_id) {
    // Desde alumno, borrar todos los días de esta repetición solo para este alumno
    const { error } = await supabaseAdmin
      .from('eventos_calendario')
      .delete()
      .eq('grupo_repeticion_id', evento.grupo_repeticion_id)
      .eq('alumno_id', evento.alumno_id);
    if (error) throw new Error(error.message);
  } else {
    // Borrar solo este evento concreto
    const { error } = await supabaseAdmin
      .from('eventos_calendario')
      .delete()
      .eq('id', eventoId);
    if (error) throw new Error(error.message);
  }
};

const generarEventosRepetidos = (dto: any) => {
  const eventos = [];
  const inicio = new Date(dto.rango_inicio + 'T00:00:00');
  const fin = new Date(dto.rango_fin + 'T00:00:00');
  const [hI, mI] = (dto.fecha_inicio.includes('T')
    ? dto.fecha_inicio.split('T')[1]
    : '00:00').split(':').map(Number);
  const [hF, mF] = dto.fecha_fin && dto.fecha_fin.includes('T')
    ? dto.fecha_fin.split('T')[1].split(':').map(Number)
    : [null, null];

  const actual = new Date(inicio);
  while (actual <= fin) {
    const diaSemana = actual.getDay() === 0 ? 7 : actual.getDay();
    if (dto.dias_semana.includes(diaSemana)) {
      const fechaBase = `${actual.getFullYear()}-${String(actual.getMonth() + 1).padStart(2, '0')}-${String(actual.getDate()).padStart(2, '0')}`;

      eventos.push({
        clase_id: dto.clase_id,
        titulo: dto.titulo,
        tipo: dto.tipo,
        fecha_inicio: `${fechaBase}T${String(hI).padStart(2, '0')}:${String(mI).padStart(2, '0')}:00`,
        fecha_fin: hF !== null ? `${fechaBase}T${String(hF).padStart(2, '0')}:${String(mF).padStart(2, '0')}:00` : null,
        deadline: dto.deadline ?? null,
        se_repite: true,
        rango_inicio: dto.rango_inicio,
        rango_fin: dto.rango_fin,
        dias_semana: dto.dias_semana,
        creado_por: dto.creado_por,
      });
    }
    actual.setDate(actual.getDate() + 1);
  }
  return eventos;
};