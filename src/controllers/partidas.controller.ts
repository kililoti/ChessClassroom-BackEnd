import { Request, Response } from 'express';
import * as partidasService from '../services/partidas.service';
import { supabaseAdmin } from '../config/supabase';

export const crearPartida = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuario = (req as any).usuario;
    const {
      clase_id,
      jugador_blancas_id,
      jugador_negras_id,
      torneo_id,
      fen_inicial,
      pgn_inicial,
      tiempo_blancas_ms,
      tiempo_negras_ms,
      incremento_ms,
    } = req.body;

    if (!clase_id || !tiempo_blancas_ms || !tiempo_negras_ms) {
      res.status(400).json({ success: false, error: 'Faltan campos obligatorios.' });
      return;
    }

    // Solo el profesor puede asignar dos jugadores que no incluyan al creador
    if (jugador_blancas_id && jugador_negras_id && usuario.rol !== 'profesor') {
      const unoEsElCreador = jugador_blancas_id === usuario.id || jugador_negras_id === usuario.id;
      if (!unoEsElCreador) {
        res.status(403).json({ success: false, error: 'Solo el profesor puede asignar ambos jugadores.' });
        return;
      }
    }

    // No se puede asignar el mismo usuario a ambos colores
    if (jugador_blancas_id && jugador_negras_id && jugador_blancas_id === jugador_negras_id) {
      res.status(400).json({ success: false, error: 'No se puede asignar el mismo jugador a ambos colores.' });
      return;
    }

    const partida = await partidasService.crearPartida({
      clase_id,
      creador_id: usuario.id,
      jugador_blancas_id: jugador_blancas_id ?? null,
      jugador_negras_id:  jugador_negras_id  ?? null,
      torneo_id:          torneo_id          ?? null,
      fen_inicial,
      pgn_inicial,
      tiempo_blancas_ms,
      tiempo_negras_ms,
      incremento_ms: incremento_ms ?? 0,
    });

    res.status(201).json({ success: true, partida });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const listarPartidas = async (req: Request, res: Response): Promise<void> => {
  try {
    const { claseId } = req.params as { claseId: string };
    const usuario     = (req as any).usuario;
    const historial   = req.query.historial === 'true';

    if (!claseId) {
      res.status(400).json({ success: false, error: 'Falta el ID de clase.' });
      return;
    }

    const partidas = await partidasService.listarPartidasDeClase(
      claseId,
      usuario.id,
      usuario.rol === 'profesor',
      historial,
    );

    res.status(200).json({ success: true, partidas });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const obtenerPartida = async (req: Request, res: Response): Promise<void> => {
  try {
    const { partidaId } = req.params as { partidaId: string };

    if (!partidaId) {
      res.status(400).json({ success: false, error: 'Falta el ID de partida.' });
      return;
    }

    const partida = await partidasService.obtenerPartida(partidaId);
    res.status(200).json({ success: true, partida });
  } catch (error: any) {
    const status = error.message.includes('no encontrada') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
};

export const unirseAPartida = async (req: Request, res: Response): Promise<void> => {
  try {
    const { partidaId } = req.params as { partidaId: string };
    const usuario       = (req as any).usuario;

    const partida = await partidasService.unirseAPartida(partidaId, usuario.id);
    res.status(200).json({ success: true, partida });
  } catch (error: any) {
    const status = error.message.includes('permiso') || error.message.includes('ti mismo') ? 403 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
};

export const iniciarPartida = async (req: Request, res: Response): Promise<void> => {
  try {
    const { partidaId } = req.params as { partidaId: string };

    const partida = await partidasService.iniciarPartida(partidaId);

    const timestamp = new Date().toISOString();

    // Emitir INICIO desde el backend para garantizar que todos lo reciben
    await supabaseAdmin.channel(`partida:${partidaId}`).send({
      type: 'broadcast',
      event: 'INICIO',
      payload: { tipo: 'INICIO', timestamp },
    });

    res.status(200).json({ success: true, partida, timestamp });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const realizarMovimiento = async (req: Request, res: Response): Promise<void> => {
  try {
    const { partidaId } = req.params as { partidaId: string };
    const usuario       = (req as any).usuario;
    const { movimiento } = req.body;

    if (!movimiento) {
      res.status(400).json({ success: false, error: 'Falta el movimiento.' });
      return;
    }

    const resultado = await partidasService.realizarMovimiento(partidaId, usuario.id, movimiento);
    res.status(200).json({ success: true, ...resultado });
  } catch (error: any) {
    const status = error.message.includes('turno') || error.message.includes('inválido') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
};

export const gestionarTablas = async (req: Request, res: Response): Promise<void> => {
  try {
    const { partidaId } = req.params as { partidaId: string };
    const usuario       = (req as any).usuario;
    const { accion }    = req.body; // 'ofrecer' | 'aceptar' | 'rechazar'

    if (!['ofrecer', 'aceptar', 'rechazar'].includes(accion)) {
      res.status(400).json({ success: false, error: 'Acción inválida.' });
      return;
    }

    const resultado = await partidasService.gestionarTablas(partidaId, usuario.id, accion);
    res.status(200).json({ success: true, ...resultado });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const abandonarPartida = async (req: Request, res: Response): Promise<void> => {
  try {
    const { partidaId } = req.params as { partidaId: string };
    const usuario       = (req as any).usuario;

    const resultado = await partidasService.abandonarPartida(partidaId, usuario.id);
    res.status(200).json({ success: true, ...resultado });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const eliminarPartida = async (req: Request, res: Response): Promise<void> => {
  try {
    const { partidaId } = req.params as { partidaId: string };
    const usuario       = (req as any).usuario;

    await partidasService.eliminarPartida(partidaId, usuario.id, usuario.rol === 'profesor');
    res.status(200).json({ success: true, mensaje: 'Partida eliminada correctamente.' });
  } catch (error: any) {
    const status = error.message.includes('permisos') ? 403 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
};

export const guardarEnEstudio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { partidaId } = req.params as { partidaId: string };
    const usuario       = (req as any).usuario;
    const { carpeta_id } = req.body;

    if (usuario.rol !== 'profesor') {
      res.status(403).json({ success: false, error: 'Solo el profesor puede guardar partidas en estudio.' });
      return;
    }

    if (!carpeta_id) {
      res.status(400).json({ success: false, error: 'Falta el ID de carpeta.' });
      return;
    }

    const archivo = await partidasService.guardarPartidaEnEstudio(partidaId, carpeta_id, usuario.id);
    res.status(201).json({ success: true, archivo });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const obtenerMensajesChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { partidaId } = req.params as { partidaId: string };
    const resultado = await partidasService.obtenerMensajesChat(partidaId);
    res.status(200).json({ success: true, sala_id: resultado.sala_id, mensajes: resultado.mensajes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const enviarMensajeChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { partidaId } = req.params as { partidaId: string };
    const usuario       = (req as any).usuario;
    const { contenido } = req.body;

    if (!contenido?.trim()) {
      res.status(400).json({ success: false, error: 'El mensaje no puede estar vacío.' });
      return;
    }

    // Obtener clase_id de la partida para crear la sala si no existe
    const partida = await partidasService.obtenerPartida(partidaId);

    const mensaje = await partidasService.enviarMensajeChat(
      partidaId,
      partida.clase_id,
      usuario.id,
      contenido.trim(),
    );
    res.status(201).json({ success: true, mensaje });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};