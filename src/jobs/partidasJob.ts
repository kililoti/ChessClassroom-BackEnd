import { supabaseAdmin } from '../config/supabase';
import { intentarEmparejar } from '../services/torneos.service';

// Job principal
// Se ejecuta cada 5 segundos y comprueba:
// 1. Partidas iniciadas con tiempo agotado → finalizar por tiempo
// 2. Partidas iniciadas sin primer movimiento en 30s → abortar
// 3. Torneos activos con jugadores libres → intentar emparejar

export const iniciarJobPartidas = () => {
  console.log('⏱️  Job de partidas iniciado.');

  setInterval(async () => {
    try {
      await comprobarInicioTorneos();
      await comprobarFinTorneos();
      await comprobarTimeouts();
      await comprobarAbortos();
      await comprobarEmparejamientos();
    } catch (error: any) {
      console.error('Error en job de partidas:', error.message);
    }
  }, 5000);
};

// Timeout de tiempo

const comprobarTimeouts = async () => {
  const { data: partidas, error } = await supabaseAdmin
    .from('partidas')
    .select('id, turno, tiempo_restante_blancas_ms, tiempo_restante_negras_ms, timestamp_ultimo_movimiento, torneo_id, iniciada_at')
    .eq('estado', 'iniciada')
    .not('timestamp_ultimo_movimiento', 'is', null);

  if (error || !partidas) return;

  const ahora = Date.now();

  for (const partida of partidas) {
    const ultimoMovimiento   = new Date(partida.timestamp_ultimo_movimiento).getTime();
    const tiempoTranscurrido = ahora - ultimoMovimiento;

    const tiempoRestante = partida.turno === 'w'
      ? partida.tiempo_restante_blancas_ms
      : partida.tiempo_restante_negras_ms;

    if (tiempoTranscurrido < tiempoRestante) continue;

    // No finalizar por tiempo durante los primeros 30s (periodo de gracia del primer movimiento)
    const partida2 = partida as any;
    if (partida2.iniciada_at) {
      const segundosDesdeInicio = (ahora - new Date(partida2.iniciada_at).getTime()) / 1000;
      if (segundosDesdeInicio < 30) continue;
    }

    const resultado = partida.turno === 'w' ? '0-1' : '1-0';

    await supabaseAdmin.rpc('finalizar_partida', {
      p_partida_id: partida.id,
      p_resultado:  resultado,
      p_motivo:     'tiempo',
      p_pgn_final:  null,
    });

    // Notificar al frontend
    await supabaseAdmin.channel(`partida:${partida.id}`).send({
      type: 'broadcast', event: 'FIN',
      payload: { tipo: 'FIN', resultado, motivo: 'tiempo' },
    });

    console.log(`⏰ Partida ${partida.id} finalizada por tiempo. Resultado: ${resultado}`);

    if (partida.torneo_id) {
      await intentarEmparejar(partida.torneo_id);
    }
  }
};

// Abort por falta de primer movimiento (30s)

const comprobarAbortos = async () => {
  const { data: partidas, error } = await supabaseAdmin
    .from('partidas')
    .select('id, iniciada_at, timestamp_ultimo_movimiento, primer_movimiento_blancas, primer_movimiento_negras, torneo_id, jugador_blancas_id, jugador_negras_id')
    .eq('estado', 'iniciada')
    .not('iniciada_at', 'is', null);

  if (error || !partidas) return;

  const ahora = Date.now();

  for (const partida of partidas) {
    const primeroMovio  = partida.primer_movimiento_blancas || partida.primer_movimiento_negras;
    const ambosMovieron = partida.primer_movimiento_blancas && partida.primer_movimiento_negras;

    // Si ambos ya movieron, no hay nada que abortar
    if (ambosMovieron) continue;

    const faltaBlancas = !partida.primer_movimiento_blancas && !!partida.jugador_blancas_id;
    const faltaNegras  = !partida.primer_movimiento_negras  && !!partida.jugador_negras_id;

    if (!faltaBlancas && !faltaNegras) continue;

    let debeAbortar = false;

    if (!primeroMovio) {
      // Nadie ha movido: abortar si han pasado 30s desde iniciada_at
      const segundosDesdeInicio = (ahora - new Date(partida.iniciada_at).getTime()) / 1000;
      debeAbortar = segundosDesdeInicio >= 30;
    } else {
      // El primero ya movió, falta el segundo: abortar si han pasado 30s desde el último movimiento
      const ultimoMovimiento = partida.timestamp_ultimo_movimiento;
      if (ultimoMovimiento) {
        const segundosDesdeUltimoMov = (ahora - new Date(ultimoMovimiento).getTime()) / 1000;
        debeAbortar = segundosDesdeUltimoMov >= 30;
      }
    }

    if (!debeAbortar) continue;

    if (!faltaBlancas && !faltaNegras) continue;

    if (!partida.torneo_id) {
      // Partida libre → abort sin resultado
      await supabaseAdmin
        .from('partidas')
        .update({ estado: 'abortada', finalizada_at: new Date().toISOString() })
        .eq('id', partida.id);

      await supabaseAdmin.channel(`partida:${partida.id}`).send({
        type: 'broadcast', event: 'ABORT',
        payload: { tipo: 'ABORT' },
      });

      console.log(`🚫 Partida ${partida.id} abortada (sin primer movimiento en 30s).`);
    } else {
      // Torneo → derrota para quien provocó el abort, victoria para el rival
      const resultado = faltaBlancas ? '0-1' : '1-0';
      const jugadorAfk = faltaBlancas ? partida.jugador_blancas_id : partida.jugador_negras_id;

      await supabaseAdmin.rpc('finalizar_partida', {
        p_partida_id: partida.id,
        p_resultado:  resultado,
        p_motivo:     'abort',
        p_pgn_final:  null,
      });

      // finalizar_partida pone estado='finalizada', pero un abort debe quedar como 'abortada'
      await supabaseAdmin
        .from('partidas')
        .update({ estado: 'abortada' })
        .eq('id', partida.id);

      // Resetear el ping del jugador AFK para que deba volver al torneo antes de ser emparejado
      if (jugadorAfk) {
        await supabaseAdmin
          .from('torneo_participantes')
          .update({ ultimo_ping_at: null })
          .eq('torneo_id', partida.torneo_id)
          .eq('usuario_id', jugadorAfk);
      }

      await supabaseAdmin.channel(`partida:${partida.id}`).send({
        type: 'broadcast', event: 'FIN',
        payload: { tipo: 'FIN', resultado, motivo: 'abort' },
      });

      console.log(`🏳️  Partida torneo ${partida.id} abortada. Resultado: ${resultado}`);

      await intentarEmparejar(partida.torneo_id);
    }
  }
};

// 3. Emparejamiento arena

const comprobarEmparejamientos = async () => {
  const { data: torneos, error } = await supabaseAdmin
    .from('torneos')
    .select('id')
    .eq('estado', 'activo');

  if (error || !torneos) return;

  for (const torneo of torneos) {
    const emparejamiento = await intentarEmparejar(torneo.id);
    if (emparejamiento) {
      console.log(`🎯 Nuevo emparejamiento en torneo ${torneo.id}: ${emparejamiento.jugador_blancas_id} vs ${emparejamiento.jugador_negras_id}`);
    }
  }
};

// Inicio automático de torneos por fecha

const comprobarInicioTorneos = async () => {
  const ahora = new Date().toISOString();

  const { data: torneos, error } = await supabaseAdmin
    .from('torneos')
    .select('id')
    .in('estado', ['programado'])
    .not('fecha_inicio', 'is', null)
    .lte('fecha_inicio', ahora);

  if (error || !torneos?.length) return;

  for (const torneo of torneos) {
    try {
      // Verificar participantes con query explícita (más fiable que el select embebido)
      const { count, error: countError } = await supabaseAdmin
        .from('torneo_participantes')
        .select('*', { count: 'exact', head: true })
        .eq('torneo_id', torneo.id);

      if (countError || (count ?? 0) < 2) continue;

      // Añadir .eq('estado', 'programado') para evitar race conditions
      const { error: errUpdate } = await supabaseAdmin
        .from('torneos')
        .update({ estado: 'activo' })
        .eq('id', torneo.id)
        .eq('estado', 'programado');

      if (errUpdate) {
        console.error(`Error al activar torneo ${torneo.id}:`, errUpdate.message);
        continue;
      }

      console.log(`🏆 Torneo ${torneo.id} iniciado automáticamente por fecha.`);

      await supabaseAdmin.channel(`torneo:${torneo.id}`).send({
        type: 'broadcast', event: 'INICIO_TORNEO',
        payload: { tipo: 'INICIO_TORNEO' },
      });

      await intentarEmparejar(torneo.id);

    } catch (err: any) {
      console.error(`Error al iniciar torneo ${torneo.id}:`, err.message);
    }
  }
};

// Fin automático de torneos por fecha

const comprobarFinTorneos = async () => {
  const ahora = new Date().toISOString();

  const { data: torneos, error } = await supabaseAdmin
    .from('torneos')
    .select('id')
    .eq('estado', 'activo')
    .not('fecha_fin', 'is', null)
    .lte('fecha_fin', ahora);

  if (error || !torneos) return;

  for (const torneo of torneos) {
    // Marcar el torneo como finalizado — las partidas en curso continúan de forma normal
    await supabaseAdmin
      .from('torneos')
      .update({ estado: 'finalizado' })
      .eq('id', torneo.id);

    console.log(`🏁 Torneo ${torneo.id} finalizado automáticamente por fecha.`);

    // Notificar al frontend para que actualice el estado
    await supabaseAdmin.channel(`torneo:${torneo.id}`).send({
      type: 'broadcast', event: 'FIN_TORNEO',
      payload: { tipo: 'FIN_TORNEO' },
    });
  }
};