import { supabaseAdmin } from '../config/supabase';

// Crear invitación (challenge)

export const crearInvitacion = async (
  partidaId: string,
  deUsuarioId: string,
  paraUsuarioId: string,
) => {
  // Evitar invitarse a uno mismo
  if (deUsuarioId === paraUsuarioId) {
    throw new Error('No puedes invitarte a ti mismo.');
  }

  // Comprobar que la partida existe y está esperando
  const { data: partida, error: partidaError } = await supabaseAdmin
    .from('partidas')
    .select('id, estado, jugador_blancas_id, jugador_negras_id, clase_id')
    .eq('id', partidaId)
    .single();

  if (partidaError || !partida) throw new Error('Partida no encontrada.');
  if (partida.estado !== 'esperando') throw new Error('La partida ya no está disponible.');

  // Comprobar que no hay una invitación pendiente ya para este usuario
  const { data: existente } = await supabaseAdmin
    .from('invitaciones_partida')
    .select('id')
    .eq('partida_id', partidaId)
    .eq('para_usuario_id', paraUsuarioId)
    .eq('estado', 'pendiente')
    .single();

  if (existente) throw new Error('Ya existe una invitación pendiente para este usuario.');

  const { data, error } = await supabaseAdmin
    .from('invitaciones_partida')
    .insert({
      partida_id:      partidaId,
      de_usuario_id:   deUsuarioId,
      para_usuario_id: paraUsuarioId,
    })
    .select()
    .single();

  if (error) throw new Error(`Error al crear invitación: ${error.message}`);
  return data;
};

// Responder invitación (aceptar / rechazar)

export const responderInvitacion = async (
  invitacionId: string,
  usuarioId: string,
  accion: 'aceptar' | 'rechazar',
) => {
  const { data: invitacion, error: invError } = await supabaseAdmin
    .from('invitaciones_partida')
    .select('*, partidas ( id, estado, jugador_blancas_id, jugador_negras_id, clase_id )')
    .eq('id', invitacionId)
    .single();

  if (invError || !invitacion) throw new Error('Invitación no encontrada.');

  if (invitacion.para_usuario_id !== usuarioId) {
    throw new Error('Esta invitación no es para ti.');
  }

  if (invitacion.estado !== 'pendiente') {
    throw new Error('Esta invitación ya fue respondida.');
  }

  // Marcar invitación como respondida
  const { error: updateError } = await supabaseAdmin
    .from('invitaciones_partida')
    .update({ estado: accion === 'aceptar' ? 'aceptada' : 'rechazada' })
    .eq('id', invitacionId);

  if (updateError) throw new Error(`Error al responder invitación: ${updateError.message}`);

  if (accion === 'rechazar') {
    return { aceptada: false, partida: null };
  }

  // Si acepta: unirse a la partida
  const partida = (invitacion as any).partidas;
  if (!partida) throw new Error('Partida asociada no encontrada.');
  if (partida.estado !== 'esperando') throw new Error('La partida ya no está disponible.');

  // Si el usuario ya está asignado (el creador lo puso directamente), devolver la partida tal cual
  const yaAsignado =
    partida.jugador_blancas_id === usuarioId ||
    partida.jugador_negras_id  === usuarioId;

  if (yaAsignado) {
    return { aceptada: true, partida };
  }

  // Determinar color libre
  const esBlancas = partida.jugador_blancas_id === null;
  const esNegras  = partida.jugador_negras_id  === null;

  if (!esBlancas && !esNegras) {
    throw new Error('La partida ya tiene ambos jugadores asignados.');
  }

  const campo = esBlancas ? 'jugador_blancas_id' : 'jugador_negras_id';

  const { data: partidaActualizada, error: joinError } = await supabaseAdmin
    .from('partidas')
    .update({ [campo]: usuarioId })
    .eq('id', partida.id)
    .select()
    .single();

  if (joinError) throw new Error(`Error al unirse a la partida: ${joinError.message}`);

  // Añadir al chat de la partida
  const { data: sala } = await supabaseAdmin
    .from('salas_chat')
    .select('id')
    .eq('partida_id', partida.id)
    .single();

  if (sala) {
    await supabaseAdmin
      .from('participantes_chat')
      .upsert(
        { sala_id: sala.id, usuario_id: usuarioId },
        { onConflict: 'sala_id,usuario_id', ignoreDuplicates: true },
      );
  }

  // Cancelar otras invitaciones pendientes para la misma partida
  await supabaseAdmin
    .from('invitaciones_partida')
    .update({ estado: 'rechazada' })
    .eq('partida_id', partida.id)
    .eq('estado', 'pendiente')
    .neq('id', invitacionId);

  return { aceptada: true, partida: partidaActualizada };
};

// Listar invitaciones pendientes del usuario

export const listarInvitacionesPendientes = async (usuarioId: string) => {
  const { data, error } = await supabaseAdmin
    .from('invitaciones_partida')
    .select(`
      *,
      de_usuario:de_usuario_id ( id, nombre, apellidos ),
      partidas (
        id, estado,
        tiempo_blancas_ms, tiempo_negras_ms, incremento_ms,
        jugador_blancas_id, jugador_negras_id
      )
    `)
    .eq('para_usuario_id', usuarioId)
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Error al listar invitaciones: ${error.message}`);
  return data;
};