import { supabaseAdmin } from '../config/supabase';
import { Chess } from 'chess.js';

// Tipos

export interface CrearTorneoInput {
  clase_id: string;
  creador_id: string;
  nombre: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  fen_inicial?: string;
  pgn_inicial?: string | null;
  tiempo_ms: number;
  incremento_ms?: number;
  participantes?: string[]; // array de usuario_ids
}

// Crear torneo

export const crearTorneo = async (input: CrearTorneoInput) => {
  const {
    clase_id,
    creador_id,
    nombre,
    fecha_inicio = null,
    fecha_fin = null,
    fen_inicial = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    pgn_inicial = null,
    tiempo_ms,
    incremento_ms = 0,
    participantes = [],
  } = input;

  // Crear el torneo (Se guarda con el estado explícito 'programado')
  const { data: torneo, error } = await supabaseAdmin
    .from('torneos')
    .insert({
      clase_id,
      creador_id,
      nombre,
      fecha_inicio,
      fecha_fin,
      fen_inicial,
      pgn_inicial,
      tiempo_ms,
      incremento_ms,
      estado: 'programado',
    })
    .select()
    .single();

  if (error) throw new Error(`Error al crear torneo: ${error.message}`);

  // Añadir jugadores al torneo si se proporcionan inicialmente
  if (participantes.length > 0) {
    const participantsSet = new Set<string>(participantes);
    await supabaseAdmin
      .from('torneo_participantes')
      .insert([...participantsSet].map(uid => ({
        torneo_id:  torneo.id,
        usuario_id: uid,
      })));
  }

  // Crear sala de chat general del torneo (Respeta la restricción: clase_id se omite)
  const { data: sala, error: salaError } = await supabaseAdmin
    .from('salas_chat')
    .insert({
      tipo:     'torneo',
      clase_id, // ¡Volvemos a ponerlo aquí! Así cumple la primera regla del CHECK
      torneo_id: torneo.id,
      nombre:   `Chat torneo: ${nombre}`,
    })
    .select('id')
    .single();

  if (salaError) {
    console.error('Error crítico: El torneo se creó pero falló la sala de chat:', salaError);
  } else if (sala) {
    // Añadir automáticamente a todos los participantes de la clase a la sala de chat
    const [{ data: profesores }, { data: alumnos }] = await Promise.all([
      supabaseAdmin.from('clase_profesores').select('profesor_id').eq('clase_id', clase_id),
      supabaseAdmin.from('clase_alumnos').select('alumno_id').eq('clase_id', clase_id),
    ]);

    const usuariosParaChat = new Set<string>([
      creador_id, 
      ...participantes,
      ...(profesores ?? []).map((p: any) => p.profesor_id),
      ...(alumnos    ?? []).map((a: any) => a.alumno_id),
    ]);

    if (usuariosParaChat.size > 0) {
      const { error: errorPart } = await supabaseAdmin
        .from('participantes_chat')
        .insert([...usuariosParaChat].map(uid => ({
          sala_id:    sala.id,
          usuario_id: uid,
        })));

      if (errorPart) {
        console.error('Advertencia: No se pudieron añadir los participantes al chat del torneo:', errorPart);
      }
    }
  }

  return torneo;
};

// Listar torneos de una clase

export const listarTorneosDeClase = async (
  claseId: string,
  esProfesor: boolean,
  historial: boolean = false,
) => {
  let query = supabaseAdmin
    .from('torneos')
    .select(`
      *,
      creador:creador_id ( id, nombre, apellidos ),
      torneo_participantes ( usuario_id )
    `)
    .eq('clase_id', claseId)
    .order('created_at', { ascending: false });

  if (historial) {
    query = query.eq('estado', 'finalizado');
  } else if (esProfesor) {
    query = query.neq('estado', 'finalizado');
  } else {
    // Alumnos solo ven torneos activos o programados
    query = query.in('estado', ['programado', 'activo']); // 👈 Modificado 'esperando' por 'programado'
  }

  const { data, error } = await query;
  if (error) throw new Error(`Error al listar torneos: ${error.message}`);
  return data;
};

// Obtener torneo por ID con puntuaciones

export const obtenerTorneo = async (torneoId: string) => {
  const { data, error } = await supabaseAdmin
    .from('torneos')
    .select(`
      *,
      creador:creador_id ( id, nombre, apellidos ),
      torneo_participantes (
        usuario_id, puntos, partidas_jugadas, libre, ultimo_ping_at,
        usuarios:usuario_id ( id, nombre, apellidos )
      )
    `)
    .eq('id', torneoId)
    .single();

  if (error || !data) throw new Error('Torneo no encontrado.');

  const participantes = (data.torneo_participantes ?? []).sort((a: any, b: any) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    if (a.partidas_jugadas !== b.partidas_jugadas) return a.partidas_jugadas - b.partidas_jugadas;
    const nombreA = `${a.usuarios?.nombre} ${a.usuarios?.apellidos}`;
    const nombreB = `${b.usuarios?.nombre} ${b.usuarios?.apellidos}`;
    return nombreA.localeCompare(nombreB);
  });

  return { ...data, torneo_participantes: participantes };
};

// Editar torneo

export const editarTorneo = async (
  torneoId: string,
  usuarioId: string,
  esProfesor: boolean,
  campos: Partial<{
    nombre: string;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    fen_inicial: string;
    pgn_inicial: string | null;
    tiempo_ms: number;
    incremento_ms: number;
  }>,
) => {
  const torneo = await obtenerTorneo(torneoId);

  if (!esProfesor) throw new Error('Solo el profesor puede editar torneos.');
  if (!['programado', 'activo'].includes(torneo.estado)) { // 👈 'programado' en vez de 'configurando'
    throw new Error('No se puede editar un torneo finalizado.');
  }

  const { data, error } = await supabaseAdmin
    .from('torneos')
    .update(campos)
    .eq('id', torneoId)
    .select()
    .single();

  if (error) throw new Error(`Error al editar torneo: ${error.message}`);
  return data;
};

// Eliminar torneo

export const eliminarTorneo = async (torneoId: string, esProfesor: boolean) => {
  if (!esProfesor) throw new Error('Solo el profesor puede eliminar torneos.');

  const torneo = await obtenerTorneo(torneoId);

  // Borrar sala de chat del torneo por torneo_id
  await supabaseAdmin
    .from('salas_chat')
    .delete()
    .eq('tipo', 'torneo')
    .eq('torneo_id', torneoId);

  const { error } = await supabaseAdmin
    .from('torneos')
    .delete()
    .eq('id', torneoId);

  if (error) throw new Error(`Error al eliminar torneo: ${error.message}`);
  return true;
};

// Iniciar torneo

export const iniciarTorneo = async (torneoId: string, esProfesor: boolean) => {
  if (!esProfesor) throw new Error('Solo el profesor puede iniciar torneos.');

  const torneo = await obtenerTorneo(torneoId);

  if (!['configurando', 'programado'].includes(torneo.estado)) { // 👈 Modificado 'esperando' por 'programado'
    throw new Error('El torneo no se puede iniciar en su estado actual.');
  }

  if ((torneo.torneo_participantes ?? []).length < 2) {
    throw new Error('Se necesitan al menos 2 participantes para iniciar el torneo.');
  }

  const { data, error } = await supabaseAdmin
    .from('torneos')
    .update({ estado: 'activo' })
    .eq('id', torneoId)
    .select()
    .single();

  if (error) throw new Error(`Error al iniciar torneo: ${error.message}`);

  await intentarEmparejar(torneoId);

  return data;
};

// Gestión de participantes

export const añadirParticipantes = async (
  torneoId: string,
  esProfesor: boolean,
  usuarioIds: string[],
) => {
  if (!esProfesor) throw new Error('Solo el profesor puede añadir participantes.');

  const torneo = await obtenerTorneo(torneoId);
  if (torneo.estado === 'finalizado') {
    throw new Error('No se pueden añadir participantes a un torneo finalizado.');
  }

  if (usuarioIds.length === 0) return [];

  // Buscar la sala usando torneo_id
  const { data: sala } = await supabaseAdmin
    .from('salas_chat')
    .select('id')
    .eq('tipo', 'torneo')
    .eq('torneo_id', torneoId)
    .single();

  const { data, error } = await supabaseAdmin
    .from('torneo_participantes')
    .upsert(
      usuarioIds.map(uid => ({ torneo_id: torneoId, usuario_id: uid })),
      { onConflict: 'torneo_id,usuario_id', ignoreDuplicates: true },
    )
    .select();

  if (error) throw new Error(`Error al añadir participantes: ${error.message}`);

  if (sala) {
    await supabaseAdmin
      .from('participantes_chat')
      .upsert(
        usuarioIds.map(uid => ({ sala_id: sala.id, usuario_id: uid })),
        { onConflict: 'sala_id,usuario_id', ignoreDuplicates: true },
      );
  }

  return data;
};

export const eliminarParticipante = async (
  torneoId: string,
  esProfesor: boolean,
  usuarioId: string,
) => {
  if (!esProfesor) throw new Error('Solo el profesor puede eliminar participantes.');

  const torneo = await obtenerTorneo(torneoId);
  if (torneo.estado === 'activo') {
    throw new Error('No se pueden eliminar participantes de un torneo activo.');
  }

  const { error } = await supabaseAdmin
    .from('torneo_participantes')
    .delete()
    .eq('torneo_id', torneoId)
    .eq('usuario_id', usuarioId);

  if (error) throw new Error(`Error al eliminar participante: ${error.message}`);
  return true;
};

// Listar partidas de un torneo

export const listarPartidasDeTorneo = async (
  torneoId: string,
  historial: boolean = false,
) => {
  const estadosActivos   = ['esperando', 'iniciada'];
  const estadosHistorial = ['finalizada', 'abortada'];

  const { data, error } = await supabaseAdmin
    .from('partidas')
    .select(`
      *,
      blancas:jugador_blancas_id ( id, nombre, apellidos ),
      negras:jugador_negras_id   ( id, nombre, apellidos )
    `)
    .eq('torneo_id', torneoId)
    .in('estado', historial ? estadosHistorial : estadosActivos)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Error al listar partidas del torneo: ${error.message}`);
  return data;
};

// Ping de presencia

export const pingParticipante = async (torneoId: string, usuarioId: string) => {
  await supabaseAdmin
    .from('torneo_participantes')
    .update({ ultimo_ping_at: new Date().toISOString() })
    .eq('torneo_id', torneoId)
    .eq('usuario_id', usuarioId);
};

// Motor de emparejamiento arena

export const intentarEmparejar = async (torneoId: string) => {
  const torneo = await obtenerTorneo(torneoId);
  if (torneo.estado !== 'activo') return null;

  const hace30s = new Date(Date.now() - 30 * 1000).toISOString();
  const { data: libres, error } = await supabaseAdmin
    .from('torneo_participantes')
    .select('usuario_id')
    .eq('torneo_id', torneoId)
    .eq('libre', true)
    .gte('ultimo_ping_at', hace30s);

  if (error || !libres || libres.length < 2) return null;

  const idsLibres = libres.map((p: any) => p.usuario_id);

  const hace2min = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: recientes } = await supabaseAdmin
    .from('partidas')
    .select('jugador_blancas_id, jugador_negras_id')
    .eq('torneo_id', torneoId)
    .gte('finalizada_at', hace2min);

  const parejasRecientes = new Set<string>();

  (recientes ?? []).forEach((p: any) => {
    if (p.jugador_blancas_id && p.jugador_negras_id) {
      parejasRecientes.add(`${p.jugador_blancas_id}:${p.jugador_negras_id}`);
      parejasRecientes.add(`${p.jugador_negras_id}:${p.jugador_blancas_id}`);
    }
  });

  let jugador1: string | null = null;
  let jugador2: string | null = null;

  outer:
  for (let i = 0; i < idsLibres.length; i++) {
    for (let j = i + 1; j < idsLibres.length; j++) {
      const clave = `${idsLibres[i]}:${idsLibres[j]}`;
      if (!parejasRecientes.has(clave)) {
        jugador1 = idsLibres[i];
        jugador2 = idsLibres[j];
        break outer;
      }
    }
  }

  // Si no hay pareja válida, esperar a que pasen los 2 minutos de cooldown
  if (!jugador1 || !jugador2) return null;

  let turnoInicial: 'w' | 'b' = 'w';
  const FEN_ESTANDAR = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  if (torneo.pgn_inicial) {
    try {
      const chess = new Chess();
      chess.loadPgn(torneo.pgn_inicial);
      turnoInicial = chess.turn();
    } catch {}
  } else if (torneo.fen_inicial && torneo.fen_inicial !== FEN_ESTANDAR) {
    try {
      const chess = new Chess();
      chess.load(torneo.fen_inicial);
      turnoInicial = chess.turn();
    } catch {}
  }

  const [blancas, negras] = Math.random() < 0.5
    ? [jugador1, jugador2]
    : [jugador2, jugador1];

  await supabaseAdmin
    .from('torneo_participantes')
    .update({ libre: false })
    .eq('torneo_id', torneoId)
    .in('usuario_id', [jugador1, jugador2]);

  // Las partidas de torneo arrancan directamente como iniciadas:
  // el jugador que llegue entra en CASO 1 (carga una partida ya en curso),
  // el que no aparezca es penalizado por el job de abortos a los 30s.
  // Se añaden 11s de margen para que el widget de emparejamiento (10s) tenga tiempo de redirigir.
  const ahora          = new Date();
  const inicioEfectivo = new Date(ahora.getTime() + 11000).toISOString();

  const { data: partida, error: partidaError } = await supabaseAdmin
    .from('partidas')
    .insert({
      clase_id:                    torneo.clase_id,
      creador_id:                  torneo.creador_id,
      jugador_blancas_id:          blancas,
      jugador_negras_id:           negras,
      torneo_id:                   torneoId,
      fen_inicial:                 torneo.fen_inicial,
      pgn_inicial:                 torneo.pgn_inicial,
      turno:                       turnoInicial,
      tiempo_blancas_ms:           torneo.tiempo_ms,
      tiempo_negras_ms:            torneo.tiempo_ms,
      incremento_ms:               torneo.incremento_ms,
      tiempo_restante_blancas_ms:  torneo.tiempo_ms,
      tiempo_restante_negras_ms:   torneo.tiempo_ms,
      estado:                      'iniciada',
      iniciada_at:                 inicioEfectivo,
      timestamp_ultimo_movimiento: inicioEfectivo,
    })
    .select()
    .single();

  if (partidaError) {
    await supabaseAdmin
      .from('torneo_participantes')
      .update({ libre: true })
      .eq('torneo_id', torneoId)
      .in('usuario_id', [jugador1, jugador2]);
    throw new Error(`Error al crear partida de torneo: ${partidaError.message}`);
  }

  // Chats de las partidas individuales (No rompen la regla porque no llevan torneo_id)
  const { data: sala } = await supabaseAdmin
    .from('salas_chat')
    .insert({
      tipo:       'partida',
      clase_id:   torneo.clase_id,
      partida_id: partida.id,
    })
    .select('id')
    .single();

  if (sala) {
    await supabaseAdmin
      .from('participantes_chat')
      .insert([
        { sala_id: sala.id, usuario_id: blancas },
        { sala_id: sala.id, usuario_id: negras },
      ]);
  }

  await supabaseAdmin.channel(`torneo:${torneoId}`).send({
    type:    'broadcast',
    event:   'EMPAREJAMIENTO',
    payload: {
      partida_id:         partida.id,
      jugador_blancas_id: blancas,
      jugador_negras_id:  negras,
    },
  });

  return {
    partida,
    jugador_blancas_id: blancas,
    jugador_negras_id:  negras,
  };
};

// Chat del torneo

export const obtenerMensajesChat = async (torneoId: string) => {
  const { data: sala } = await supabaseAdmin
    .from('salas_chat')
    .select('id')
    .eq('tipo', 'torneo')
    .eq('torneo_id', torneoId) 
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
  torneoId: string,
  usuarioId: string,
  contenido: string,
) => {
  const torneo = await obtenerTorneo(torneoId);

  const { data: sala } = await supabaseAdmin
    .from('salas_chat')
    .select('id')
    .eq('tipo', 'torneo')
    .eq('torneo_id', torneoId) 
    .single();

  if (!sala) throw new Error('Sala de chat del torneo no encontrada.');

  const esParticipante = (torneo.torneo_participantes ?? []).some(
    (p: any) => p.usuario_id === usuarioId,
  );
  if (!esParticipante && torneo.creador_id !== usuarioId) {
    throw new Error('No tienes permiso para escribir en este chat.');
  }

  const { data, error } = await supabaseAdmin
    .from('mensajes')
    .insert({
      sala_id:      sala.id,
      remitente_id: usuarioId,
      contenido,
    })
    .select(`*, usuarios:remitente_id ( nombre, apellidos )`)
    .single();

  if (error) throw new Error(`Error al enviar mensaje: ${error.message}`);
  return data;
};