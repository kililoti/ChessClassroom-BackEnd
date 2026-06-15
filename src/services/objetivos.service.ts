import { supabaseAdmin } from '../config/supabase';
import { CrearObjetivoDTO, CrearTablonDTO, Objetivo, TablonObjetivos } from '../types/objetivos.types';

export const getTableros = async (claseId: string, alumnoId?: string): Promise<TablonObjetivos[]> => {
  if (alumnoId) {
    // Vista individual → todos los tablones de ese alumno (grupales + individuales)
    const { data, error } = await supabaseAdmin
      .from('tablones_objetivos')
      .select(`*, objetivos(*)`)
      .eq('clase_id', claseId)
      .eq('alumno_id', alumnoId)
      .order('creado_en');

    if (error) throw new Error(error.message);
    return data as TablonObjetivos[];
  }

  // Vista grupo completo → solo filas de referencia (alumno_id = null)
  const { data, error } = await supabaseAdmin
    .from('tablones_objetivos')
    .select(`*, objetivos(*)`)
    .eq('clase_id', claseId)
    .is('alumno_id', null)
    .order('creado_en');

  if (error) throw new Error(error.message);
  return data as TablonObjetivos[];
};

export const crearTablon = async (dto: CrearTablonDTO): Promise<TablonObjetivos[]> => {
  if (!dto.alumno_id) {
    // Tablón grupal → crear fila de referencia (alumno_id = null) + copias para cada alumno

    // 1. Fila de referencia para la vista de grupo completo
    const { data: referencia, error: errorRef } = await supabaseAdmin
      .from('tablones_objetivos')
      .insert({
        clase_id: dto.clase_id,
        alumno_id: null,
        titulo: dto.titulo,
        descripcion: dto.descripcion ?? null,
        fecha_limite: dto.fecha_limite ?? null,
        creado_por: dto.creado_por,
        origen_grupal: true,
      })
      .select()
      .single();

    if (errorRef) throw new Error(errorRef.message);

    // 2. Copias individuales para cada alumno
    const { data: alumnos, error: errorAlumnos } = await supabaseAdmin
      .from('clase_alumnos')
      .select('alumno_id')
      .eq('clase_id', dto.clase_id);

    if (errorAlumnos) throw new Error(errorAlumnos.message);

    if (alumnos && alumnos.length > 0) {
      const copias = alumnos.map((a: { alumno_id: string }) => ({
        clase_id: dto.clase_id,
        alumno_id: a.alumno_id,
        titulo: dto.titulo,
        descripcion: dto.descripcion ?? null,
        fecha_limite: dto.fecha_limite ?? null,
        creado_por: dto.creado_por,
        origen_grupal: true,
      }));

      const { error: errorCopias } = await supabaseAdmin
        .from('tablones_objetivos')
        .insert(copias);

      if (errorCopias) throw new Error(errorCopias.message);
    }

    return [referencia as TablonObjetivos];
  }

  // Tablón individual → solo para ese alumno
  const { data, error } = await supabaseAdmin
    .from('tablones_objetivos')
    .insert({
      clase_id: dto.clase_id,
      alumno_id: dto.alumno_id,
      titulo: dto.titulo,
      descripcion: dto.descripcion ?? null,
      fecha_limite: dto.fecha_limite ?? null,
      creado_por: dto.creado_por,
      origen_grupal: false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return [data as TablonObjetivos];
};

export const eliminarTablon = async (tablonId: string): Promise<void> => {
  const { data: tablon, error: errorTablon } = await supabaseAdmin
    .from('tablones_objetivos')
    .select('clase_id, titulo, origen_grupal, alumno_id')
    .eq('id', tablonId)
    .single();

  if (errorTablon) throw new Error(errorTablon.message);

  if (tablon.origen_grupal && tablon.alumno_id === null) {
    // Es referencia de grupo → borrar referencia + todas las copias de alumnos
    const { error } = await supabaseAdmin
      .from('tablones_objetivos')
      .delete()
      .eq('clase_id', tablon.clase_id)
      .eq('titulo', tablon.titulo)
      .eq('origen_grupal', true);

    if (error) throw new Error(error.message);
  } else {
    // Tablón individual → borrar solo ese
    const { error } = await supabaseAdmin
      .from('tablones_objetivos')
      .delete()
      .eq('id', tablonId);

    if (error) throw new Error(error.message);
  }
};

export const crearObjetivoGrupal = async (
  tablonTitulo: string,
  claseId: string,
  titulo: string,
  fechaLimite: string | null
): Promise<void> => {
  // Buscar todos los tablones con ese título (referencia + copias de alumnos)
  const { data: tablones, error } = await supabaseAdmin
    .from('tablones_objetivos')
    .select('id')
    .eq('clase_id', claseId)
    .eq('titulo', tablonTitulo)
    .eq('origen_grupal', true);

  if (error) throw new Error(error.message);
  if (!tablones || tablones.length === 0) throw new Error('No se encontraron tablones con ese título');

  const objetivos = tablones.map((t: { id: string }) => ({
    tablon_id: t.id,
    titulo,
    fecha_limite: fechaLimite,
  }));

  const { error: errorInsert } = await supabaseAdmin
    .from('objetivos')
    .insert(objetivos);

  if (errorInsert) throw new Error(errorInsert.message);
};

export const crearObjetivo = async (dto: CrearObjetivoDTO): Promise<Objetivo> => {
  const { data, error } = await supabaseAdmin
    .from('objetivos')
    .insert(dto)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Objetivo;
};

export const toggleObjetivo = async (objetivoId: string): Promise<Objetivo> => {
  const { data: objetivo, error: fetchError } = await supabaseAdmin
    .from('objetivos')
    .select('completado')
    .eq('id', objetivoId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const nuevoEstado = !objetivo.completado;

  const { data, error } = await supabaseAdmin
    .from('objetivos')
    .update({
      completado: nuevoEstado,
      completado_en: nuevoEstado ? new Date().toISOString() : null,
    })
    .eq('id', objetivoId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Objetivo;
};

export const eliminarObjetivo = async (objetivoId: string): Promise<void> => {
  // Obtener el objetivo para saber a qué tablón pertenece
  const { data: objetivo, error: errorObj } = await supabaseAdmin
    .from('objetivos')
    .select('tablon_id, titulo')
    .eq('id', objetivoId)
    .single();

  if (errorObj) throw new Error(errorObj.message);

  // Obtener el tablón para saber si es referencia de grupo
  const { data: tablon, error: errorTablon } = await supabaseAdmin
    .from('tablones_objetivos')
    .select('clase_id, titulo, origen_grupal, alumno_id')
    .eq('id', objetivo.tablon_id)
    .single();

  if (errorTablon) throw new Error(errorTablon.message);

  if (tablon.origen_grupal && tablon.alumno_id === null) {
    // Objetivo de referencia grupal → borrar en todos los tablones grupales con ese título
    const { data: tablones } = await supabaseAdmin
      .from('tablones_objetivos')
      .select('id')
      .eq('clase_id', tablon.clase_id)
      .eq('titulo', tablon.titulo)
      .eq('origen_grupal', true);

    if (tablones && tablones.length > 0) {
      const tablonesIds = tablones.map((t: { id: string }) => t.id);

      const { error } = await supabaseAdmin
        .from('objetivos')
        .delete()
        .in('tablon_id', tablonesIds)
        .eq('titulo', objetivo.titulo);

      if (error) throw new Error(error.message);
    }
  } else {
    // Objetivo individual → borrar solo ese
    const { error } = await supabaseAdmin
      .from('objetivos')
      .delete()
      .eq('id', objetivoId);

    if (error) throw new Error(error.message);
  }
};

export const editarTablon = async (
  tablonId: string,
  campos: { titulo?: string; descripcion?: string | null; fecha_limite?: string | null }
): Promise<TablonObjetivos> => {
  const { data: tablon, error: errorTablon } = await supabaseAdmin
    .from('tablones_objetivos')
    .select('clase_id, titulo, origen_grupal, alumno_id')
    .eq('id', tablonId)
    .single();

  if (errorTablon) throw new Error(errorTablon.message);

  if (tablon.origen_grupal && tablon.alumno_id === null) {
    // Es referencia de grupo → actualizar también todas las copias de alumnos
    await supabaseAdmin
      .from('tablones_objetivos')
      .update(campos)
      .eq('clase_id', tablon.clase_id)
      .eq('titulo', tablon.titulo)
      .eq('origen_grupal', true)
      .neq('id', tablonId); // las copias, no la referencia
  }

  // Actualizar el propio tablón (referencia o individual)
  const { data, error } = await supabaseAdmin
    .from('tablones_objetivos')
    .update(campos)
    .eq('id', tablonId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as TablonObjetivos;
};