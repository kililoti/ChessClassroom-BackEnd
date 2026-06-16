import { supabaseAdmin } from '../config/supabase';

export const obtenerOCrearAula = async (claseId: string, usuarioId: string) => {
  const { data: aulaExistente } = await supabaseAdmin
    .from('aulas_virtuales')
    .select('*')
    .eq('clase_id', claseId)
    .eq('activa', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (aulaExistente) return aulaExistente;

  // Crear el aula
  const { data: nuevaAula, error } = await supabaseAdmin
    .from('aulas_virtuales')
    .insert({ clase_id: claseId })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Crear sala de chat del aula
  const { data: sala, error: errorSala } = await supabaseAdmin
    .from('salas_chat')
    .insert({
      clase_id: claseId,
      nombre: 'Aula virtual',
      tipo: 'clase_aula'
    })
    .select('id')
    .single();

  if (errorSala) throw new Error(errorSala.message);

  // Obtener todos los profesores y alumnos de la clase en paralelo
  const [{ data: profesores }, { data: alumnos }] = await Promise.all([
    supabaseAdmin
      .from('clase_profesores')
      .select('profesor_id')
      .eq('clase_id', claseId),
    supabaseAdmin
      .from('clase_alumnos')
      .select('alumno_id')
      .eq('clase_id', claseId)
  ]);

  // Construir array de participantes
  const participantes = [
    ...(profesores ?? []).map((p) => ({ sala_id: sala.id, usuario_id: p.profesor_id })),
    ...(alumnos ?? []).map((a) => ({ sala_id: sala.id, usuario_id: a.alumno_id }))
  ];

  if (participantes.length > 0) {
    const { error: errorParticipantes } = await supabaseAdmin
      .from('participantes_chat')
      .insert(participantes);

    if (errorParticipantes) throw new Error(errorParticipantes.message);
  }

  return nuevaAula;
};

export const obtenerAula = async (aulaId: string) => {
  const { data, error } = await supabaseAdmin
    .from('aulas_virtuales')
    .select('*')
    .eq('id', aulaId)
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const actualizarTablero = async (aulaId: string, fen: string, pgn: string) => {
  const { data, error } = await supabaseAdmin
    .from('aulas_virtuales')
    .update({ fen_actual: fen, pgn_actual: pgn })
    .eq('id', aulaId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const actualizarOrientacion = async (aulaId: string, orientacion: 'white' | 'black') => {
  const { data, error } = await supabaseAdmin
    .from('aulas_virtuales')
    .update({ orientacion })
    .eq('id', aulaId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const cerrarAula = async (aulaId: string) => {
  const { data, error } = await supabaseAdmin
    .from('aulas_virtuales')
    .update({ activa: false })
    .eq('id', aulaId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const obtenerPermisosAula = async (aulaId: string) => {
  const { data, error } = await supabaseAdmin
    .from('permisos_tablero_aula')
    .select(`
      *,
      alumno:usuarios(id, nombre, apellidos)
    `)
    .eq('aula_id', aulaId);

  if (error) throw new Error(error.message);
  return data;
};

export const actualizarPermisosAlumno = async (
  aulaId: string,
  alumnoId: string,
  puedeMoverBlancas: boolean,
  puedeMoverNegras: boolean
) => {
  const { data, error } = await supabaseAdmin
    .from('permisos_tablero_aula')
    .upsert({
      aula_id: aulaId,
      alumno_id: alumnoId,
      puede_mover_blancas: puedeMoverBlancas,
      puede_mover_negras: puedeMoverNegras
    }, { onConflict: 'aula_id,alumno_id' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const eliminarPermisosAlumno = async (aulaId: string, alumnoId: string) => {
  const { error } = await supabaseAdmin
    .from('permisos_tablero_aula')
    .delete()
    .eq('aula_id', aulaId)
    .eq('alumno_id', alumnoId);

  if (error) throw new Error(error.message);
};