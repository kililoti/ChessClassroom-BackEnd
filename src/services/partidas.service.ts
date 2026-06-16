'use client';

import { supabaseAdmin } from '../config/supabase';
import { Chess } from 'chess.js';

// Tipos

export interface CrearPartidaInput {
  clase_id: string;
  creador_id: string;
  jugador_blancas_id?: string | null;
  jugador_negras_id?: string | null;
  torneo_id?: string | null;
  fen_inicial?: string;
  pgn_inicial?: string | null;
  tiempo_blancas_ms: number;
  tiempo_negras_ms: number;
  incremento_ms?: number;
}

// Crear partida

export const crearPartida = async (input: CrearPartidaInput) => {
  const {
    clase_id,
    creador_id,
    jugador_blancas_id = null,
    jugador_negras_id = null,
    torneo_id = null,
    fen_inicial = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    pgn_inicial = null,
    tiempo_blancas_ms,
    tiempo_negras_ms,
    incremento_ms = 0,
  } = input;

  // Validar FEN y extraer turno inicial
  const chess = new Chess();
  try {
    chess.load(fen_inicial);
  } catch {
    throw new Error('El FEN proporcionado no es válido.');
  }

  // Validar PGN si se proporciona y extraer turno final del PGN
  let turnoInicial = chess.turn(); // turno del FEN por defecto
  if (pgn_inicial) {
    const chessPgn = new Chess();
    try {
      chessPgn.loadPgn(pgn_inicial);
      turnoInicial = chessPgn.turn(); // el turno al final del PGN sobreescribe
    } catch {
      throw new Error('El PGN proporcionado no es válido.');
    }
  }

  const { data, error } = await supabaseAdmin
    .from('partidas')
    .insert({
      clase_id,
      creador_id,
      jugador_blancas_id,
      jugador_negras_id,
      torneo_id,
      fen_inicial,
      pgn_inicial,
      tiempo_blancas_ms,
      tiempo_negras_ms,
      incremento_ms,
      turno: turnoInicial,
      tiempo_restante_blancas_ms: tiempo_blancas_ms,
      tiempo_restante_negras_ms: tiempo_negras_ms,
    })
    .select()
    .single();

  if (error) throw new Error(`Error al crear partida: ${error.message}`);

  // Las partidas de torneo no tienen chat propio
  if (!torneo_id) {
    const { data: sala, error: salaError } = await supabaseAdmin
      .from('salas_chat')
      .insert({
        tipo: 'partida',
        partida_id: data.id,
        clase_id,
      })
      .select('id')
      .single();

    if (salaError || !sala) throw new Error(`Error al crear sala de chat: ${salaError?.message}`);

    const [{ data: alumnos }, { data: profesores }] = await Promise.all([
      supabaseAdmin.from('clase_alumnos').select('alumno_id').eq('clase_id', clase_id),
      supabaseAdmin.from('clase_profesores').select('profesor_id').eq('clase_id', clase_id),
    ]);

    const participantesSet = new Set<string>();
    (alumnos   ?? []).forEach((a: any) => participantesSet.add(a.alumno_id));
    (profesores ?? []).forEach((p: any) => participantesSet.add(p.profesor_id));

    if (participantesSet.size > 0) {
      await supabaseAdmin
        .from('participantes_chat')
        .insert([...participantesSet].map(uid => ({
          sala_id:    sala.id,
          usuario_id: uid,
        })));
    }
  }

  return data;
};

// Listar partidas de una clase

export const listarPartidasDeClase = async (
  claseId: string,
  usuarioId: string,
  esProfesor: boolean,
  historial: boolean = false,
) => {
  const estadosActivos  = ['esperando', 'iniciada'];
  const estadosHistorial = ['finalizada', 'abortada'];

  const { data, error } = await supabaseAdmin
    .from('partidas')
    .select(`
      *,
      blancas:jugador_blancas_id ( id, nombre, apellidos ),
      negras:jugador_negras_id   ( id, nombre, apellidos ),
      creador:creador_id         ( id, nombre, apellidos )
    `)
    .eq('clase_id', claseId)
    .in('estado', historial ? estadosHistorial : estadosActivos)
    .is('torneo_id', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Error al listar partidas: ${error.message}`);
  return data;
};

// Obtener partida por ID

export const obtenerPartida = async (partidaId: string) => {
  const { data, error } = await supabaseAdmin
    .from('partidas')
    .select(`
      *,
      blancas:jugador_blancas_id ( id, nombre, apellidos ),
      negras:jugador_negras_id   ( id, nombre, apellidos ),
      creador:creador_id         ( id, nombre, apellidos )
    `)
    .eq('id', partidaId)
    .single();

  if (error || !data) throw new Error('Partida no encontrada.');
  return data;
};

// Unirse a una partida (color libre)

export const unirseAPartida = async (partidaId: string, usuarioId: string) => {
  const partida = await obtenerPartida(partidaId);

  if (partida.estado !== 'esperando') {
    throw new Error('La partida ya no está disponible.');
  }

  const esBlancas = partida.jugador_blancas_id === null;
  const esNegras  = partida.jugador_negras_id === null;

  if (!esBlancas && !esNegras) {
    throw new Error('La partida ya tiene ambos jugadores asignados.');
  }

  if (
    (esBlancas && partida.jugador_negras_id === usuarioId) ||
    (esNegras  && partida.jugador_blancas_id === usuarioId)
  ) {
    throw new Error('No puedes jugar contra ti mismo.');
  }

  const campo = esBlancas ? 'jugador_blancas_id' : 'jugador_negras_id';

  const { error } = await supabaseAdmin
    .from('partidas')
    .update({ [campo]: usuarioId })
    .eq('id', partidaId);

  if (error) throw new Error(`Error al unirse a la partida: ${error.message}`);

  if (!partida.torneo_id) {
    await añadirParticipanteChat(partidaId, usuarioId);
  }

  return await obtenerPartida(partidaId);
};

// Iniciar partida (ambos jugadores presentes)

export const iniciarPartida = async (partidaId: string) => {
  const { data, error } = await supabaseAdmin
    .from('partidas')
    .update({
      estado: 'iniciada',
      iniciada_at: new Date().toISOString(),
      timestamp_ultimo_movimiento: new Date().toISOString(),
    })
    .eq('id', partidaId)
    .eq('estado', 'esperando')
    .select()
    .single();

  if (error || !data) throw new Error('No se pudo iniciar la partida.');
  return data;
};

// Realizar movimiento

export const realizarMovimiento = async (
  partidaId: string,
  usuarioId: string,
  movimiento: string,
) => {
  const partida = await obtenerPartida(partidaId);

  if (partida.estado !== 'iniciada') {
    throw new Error('La partida no está en curso.');
  }

  const esBlancas = partida.jugador_blancas_id === usuarioId;
  const esNegras  = partida.jugador_negras_id  === usuarioId;

  if (!esBlancas && !esNegras) {
    throw new Error('No eres jugador de esta partida.');
  }

  const colorUsuario = esBlancas ? 'w' : 'b';
  if (partida.turno !== colorUsuario) {
    throw new Error('No es tu turno.');
  }

  const chess = new Chess();
  const fenInicial = partida.fen_inicial ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const esFenEstandar = fenInicial === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const pgnACagar = partida.pgn_final ?? partida.pgn_inicial ?? null;

  if (pgnACagar) {
    const pgnConFen = !esFenEstandar
      ? `[FEN "${fenInicial}"]\n\n${pgnACagar}`
      : pgnACagar;
    try { chess.loadPgn(pgnConFen); } catch { chess.load(fenInicial); }
  } else {
    chess.load(fenInicial);
  }

  const resultado = chess.move(movimiento);
  if (!resultado) throw new Error('Movimiento inválido.');

  const pgn        = chess.pgn();
  const turnoNuevo = chess.turn();

  let movsIniciales = 0;
  if (partida.pgn_inicial) {
    try {
      const chessInicial = new Chess();
      chessInicial.loadPgn(partida.pgn_inicial);
      movsIniciales = chessInicial.history().length;
    } catch {}
  }

  const numMovimientosTotal   = chess.history().length;
  const numMovimientosPartida = numMovimientosTotal - movsIniciales;
  const esPrimerMovColor      = numMovimientosPartida <= 2;

  const { data, error } = await supabaseAdmin.rpc('registrar_movimiento', {
    p_partida_id:      partidaId,
    p_color:           colorUsuario,
    p_pgn:             pgn,
    p_turno_nuevo:     turnoNuevo,
    p_resetear_tiempo: esPrimerMovColor,
  });

  if (error) throw new Error(`Error al registrar movimiento: ${error.message}`);

  const tiempos       = data?.[0] ?? {};
  const tiempoBlancas = tiempos.tiempo_restante_blancas_ms;
  const tiempoNegras  = tiempos.tiempo_restante_negras_ms;

  if (esPrimerMovColor) {
    const campo = colorUsuario === 'w' ? 'primer_movimiento_blancas' : 'primer_movimiento_negras';
    await supabaseAdmin
      .from('partidas')
      .update({ [campo]: true })
      .eq('id', partidaId);
  }

  let finPartida: { resultado: string; motivo: string } | null = null;

  if (chess.isCheckmate()) {
    finPartida = {
      resultado: colorUsuario === 'w' ? '1-0' : '0-1',
      motivo: 'mate',
    };
  } else if (chess.isInsufficientMaterial()) {
    finPartida = { resultado: '1/2-1/2', motivo: 'insuf_material' };
  } else if (chess.isDraw()) {
    finPartida = { resultado: '1/2-1/2', motivo: 'tablas' };
  }

  if (finPartida) {
    await supabaseAdmin.rpc('finalizar_partida', {
      p_partida_id: partidaId,
      p_resultado:  finPartida.resultado,
      p_motivo:     finPartida.motivo,
      p_pgn_final:  pgn,
    });
  }

  return {
    pgn,
    turno: turnoNuevo,
    tiempo_restante_blancas_ms: tiempoBlancas,
    tiempo_restante_negras_ms:  tiempoNegras,
    fin: finPartida,
  };
};

// Ofrecer / aceptar tablas

export const gestionarTablas = async (
  partidaId: string,
  usuarioId: string,
  accion: 'ofrecer' | 'aceptar' | 'rechazar',
) => {
  const partida = await obtenerPartida(partidaId);

  if (partida.estado !== 'iniciada') {
    throw new Error('La partida no está en curso.');
  }

  const esJugador =
    partida.jugador_blancas_id === usuarioId ||
    partida.jugador_negras_id  === usuarioId;

  if (!esJugador) throw new Error('No eres jugador de esta partida.');

  if (accion === 'aceptar') {
    await supabaseAdmin.rpc('finalizar_partida', {
      p_partida_id: partidaId,
      p_resultado:  '1/2-1/2',
      p_motivo:     'tablas',
      p_pgn_final:  partida.pgn_final,
    });
    return { finalizada: true };
  }

  return { finalizada: false, accion };
};

// Abandonar partida

export const abandonarPartida = async (partidaId: string, usuarioId: string) => {
  const partida = await obtenerPartida(partidaId);

  if (partida.estado !== 'iniciada') {
    throw new Error('La partida no está en curso.');
  }

  const esBlancas = partida.jugador_blancas_id === usuarioId;
  const esNegras  = partida.jugador_negras_id  === usuarioId;

  if (!esBlancas && !esNegras) {
    throw new Error('No eres jugador de esta partida.');
  }

  const resultado = esBlancas ? '0-1' : '1-0';

  await supabaseAdmin.rpc('finalizar_partida', {
    p_partida_id: partidaId,
    p_resultado:  resultado,
    p_motivo:     'abandono',
    p_pgn_final:  partida.pgn_final,
  });

  return { resultado };
};

// Abortar partida (sin primer movimiento en 30s)

export const abortarPartida = async (partidaId: string) => {
  const { data, error } = await supabaseAdmin
    .from('partidas')
    .update({
      estado: 'abortada',
      finalizada_at: new Date().toISOString(),
    })
    .eq('id', partidaId)
    .in('estado', ['esperando', 'iniciada'])
    .select()
    .single();

  if (error || !data) throw new Error('No se pudo abortar la partida.');
  return data;
};

// Eliminar partida

export const eliminarPartida = async (partidaId: string, usuarioId: string, esProfesor: boolean) => {
  const partida = await obtenerPartida(partidaId);

  if (!esProfesor && partida.creador_id !== usuarioId) {
    throw new Error('No tienes permisos para eliminar esta partida.');
  }

  if (partida.estado === 'iniciada') {
    throw new Error('No se puede eliminar una partida en curso. Usa abandonar primero.');
  }

  await supabaseAdmin
    .from('salas_chat')
    .delete()
    .eq('partida_id', partidaId);

  const { error } = await supabaseAdmin
    .from('partidas')
    .delete()
    .eq('id', partidaId);

  if (error) throw new Error(`Error al eliminar partida: ${error.message}`);
  return true;
};

// Añadir participante al chat cuando se une a la partida

export const añadirParticipanteChat = async (partidaId: string, usuarioId: string) => {
  const { data: sala } = await supabaseAdmin
    .from('salas_chat')
    .select('id')
    .eq('partida_id', partidaId)
    .single();

  if (!sala) return;

  await supabaseAdmin
    .from('participantes_chat')
    .upsert(
      { sala_id: sala.id, usuario_id: usuarioId },
      { onConflict: 'sala_id,usuario_id', ignoreDuplicates: true },
    );
};

// Guardar partida en estudio

export const guardarPartidaEnEstudio = async (
  partidaId: string,
  carpetaId: string,
  profesorId: string,
) => {
  const partida = await obtenerPartida(partidaId);

  if (!partida.pgn_final) {
    throw new Error('La partida no tiene PGN para guardar.');
  }

  const blancas = (partida as any).blancas;
  const negras  = (partida as any).negras;
  const nombreBlancas = blancas ? `${blancas.nombre} ${blancas.apellidos}` : 'Anónimo';
  const nombreNegras  = negras  ? `${negras.nombre} ${negras.apellidos}`   : 'Anónimo';
  const fecha = new Date().toLocaleDateString('es-ES');
  const nombre = `${nombreBlancas} vs ${nombreNegras} (${fecha})`;

  const pgnConCabeceras = [
    `[Event "Partida de clase"]`,
    `[Date "${fecha}"]`,
    `[White "${nombreBlancas}"]`,
    `[Black "${nombreNegras}"]`,
    `[Result "${partida.resultado ?? '*'}"]`,
    '',
    partida.pgn_final,
  ].join('\n');

  const buffer      = Buffer.from(pgnConCabeceras, 'utf-8');
  const timestamp   = Date.now();
  const storagePath = `recursos/${profesorId}/${timestamp}_partida.pgn`;

  const { error: storageError } = await supabaseAdmin.storage
    .from('recursos_educativos')
    .upload(storagePath, buffer, { contentType: 'text/plain', upsert: false });

  if (storageError) throw new Error(`Error en Storage: ${storageError.message}`);

  const { data: registroBD, error: dbError } = await supabaseAdmin
    .from('recursos_archivos')
    .insert({
      nombre,
      carpeta_id: carpetaId,
      profesor_id: profesorId,
      categoria: 'partida',
      storage_path: storagePath,
      metadata: {
        es_base_datos: false,
        total_partidas: 1,
        partidas: [{
          index: 0,
          blancas: nombreBlancas,
          negras: nombreNegras,
          resultado: partida.resultado ?? '*',
          fecha,
          evento: 'Partida de clase',
        }],
      },
      visible: true,
      tipo_recurso: 'estudio',
    })
    .select()
    .single();

  if (dbError) {
    await supabaseAdmin.storage.from('recursos_educativos').remove([storagePath]);
    throw new Error(`Error en Base de Datos: ${dbError.message}`);
  }

  return registroBD;
};

// Chat de partida

const obtenerOCrearSalaChat = async (partidaId: string, claseId: string) => {
  const { data: salaExistente } = await supabaseAdmin
    .from('salas_chat')
    .select('id')
    .eq('partida_id', partidaId)
    .single();

  if (salaExistente) return salaExistente.id;

  const { data: salaNueva, error } = await supabaseAdmin
    .from('salas_chat')
    .insert({
      tipo: 'partida',
      partida_id: partidaId,
      clase_id: claseId,
    })
    .select('id')
    .single();

  if (error || !salaNueva) throw new Error(`Error al crear sala de chat: ${error?.message}`);
  return salaNueva.id;
};

export const obtenerMensajesChat = async (partidaId: string) => {
  const { data: sala } = await supabaseAdmin
    .from('salas_chat')
    .select('id')
    .eq('partida_id', partidaId)
    .single();

  if (!sala) return { sala_id: null, mensajes: [] };

  const { data, error } = await supabaseAdmin
    .from('mensajes')
    .select(`*, usuarios:remitente_id ( nombre, apellidos )`)
    .eq('sala_id', sala.id)
    .order('creado_en', { ascending: true });

  if (error) throw new Error(`Error al obtener mensajes: ${error.message}`);
  return { sala_id: sala.id, mensajes: data };
};

export const enviarMensajeChat = async (
  partidaId: string,
  claseId: string,
  usuarioId: string,
  contenido: string,
) => {
  const salaId = await obtenerOCrearSalaChat(partidaId, claseId);

  const { data, error } = await supabaseAdmin
    .from('mensajes')
    .insert({
      sala_id:      salaId,
      remitente_id: usuarioId,
      contenido,
    })
    .select(`*, usuarios:remitente_id ( nombre, apellidos )`)
    .single();

  if (error) throw new Error(`Error al enviar mensaje: ${error.message}`);
  return data;
};