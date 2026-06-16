import { Request, Response } from 'express';
import * as torneosService from '../services/torneos.service';

export const crearTorneo = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuario = (req as any).usuario;

    if (usuario.rol !== 'profesor') {
      res.status(403).json({ success: false, error: 'Solo el profesor puede crear torneos.' });
      return;
    }

    const {
      clase_id, nombre, fecha_inicio, fecha_fin,
      fen_inicial, pgn_inicial, tiempo_ms, incremento_ms, participantes,
    } = req.body;

    if (!clase_id || !nombre || !tiempo_ms) {
      res.status(400).json({ success: false, error: 'Faltan campos obligatorios.' });
      return;
    }

    const torneo = await torneosService.crearTorneo({
      clase_id,
      creador_id: usuario.id,
      nombre,
      fecha_inicio:  fecha_inicio  ?? null,
      fecha_fin:     fecha_fin     ?? null,
      fen_inicial,
      pgn_inicial:   pgn_inicial   ?? null,
      tiempo_ms,
      incremento_ms: incremento_ms ?? 0,
      participantes: participantes ?? [],
    });

    res.status(201).json({ success: true, torneo });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const listarTorneos = async (req: Request, res: Response): Promise<void> => {
  try {
    const { claseId } = req.params as { claseId: string };
    const usuario     = (req as any).usuario;
    const historial   = req.query.historial === 'true';

    if (!claseId) {
      res.status(400).json({ success: false, error: 'Falta el ID de clase.' });
      return;
    }

    const torneos = await torneosService.listarTorneosDeClase(
      claseId,
      usuario.rol === 'profesor',
      historial,
    );

    res.status(200).json({ success: true, torneos });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const obtenerTorneo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { torneoId } = req.params as { torneoId: string };


    if (!torneoId) {
      res.status(400).json({ success: false, error: 'Falta el ID de torneo.' });
      return;
    }

    const torneo = await torneosService.obtenerTorneo(torneoId);
    res.status(200).json({ success: true, torneo });
  } catch (error: any) {
    const status = error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
};

export const editarTorneo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { torneoId } = req.params as { torneoId: string };

    const usuario      = (req as any).usuario;
    const { nombre, fecha_inicio, fecha_fin, fen_inicial, pgn_inicial, tiempo_ms, incremento_ms } = req.body;

    const torneo = await torneosService.editarTorneo(
      torneoId,
      usuario.id,
      usuario.rol === 'profesor',
      { nombre, fecha_inicio, fecha_fin, fen_inicial, pgn_inicial, tiempo_ms, incremento_ms },
    );

    res.status(200).json({ success: true, torneo });
  } catch (error: any) {
    const status = error.message.includes('profesor') ? 403 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
};

export const eliminarTorneo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { torneoId } = req.params as { torneoId: string };

    const usuario      = (req as any).usuario;

    await torneosService.eliminarTorneo(torneoId, usuario.rol === 'profesor');
    res.status(200).json({ success: true, mensaje: 'Torneo eliminado correctamente.' });
  } catch (error: any) {
    const status = error.message.includes('profesor') ? 403 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
};

export const iniciarTorneo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { torneoId } = req.params as { torneoId: string };

    const usuario      = (req as any).usuario;

    const torneo = await torneosService.iniciarTorneo(torneoId, usuario.rol === 'profesor');
    res.status(200).json({ success: true, torneo });
  } catch (error: any) {
    const status = error.message.includes('profesor') ? 403 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
};

export const pingTorneo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { torneoId } = req.params as { torneoId: string };

    const usuario      = (req as any).usuario;

    await torneosService.pingParticipante(torneoId, usuario.id);
    res.status(200).json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const añadirParticipantes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { torneoId } = req.params as { torneoId: string };
    const usuario      = (req as any).usuario;
    const { usuario_ids } = req.body;

    if (!Array.isArray(usuario_ids) || usuario_ids.length === 0) {
      res.status(400).json({ success: false, error: 'Debes proporcionar al menos un usuario_id.' });
      return;
    }

    const participantes = await torneosService.añadirParticipantes(
      torneoId,
      usuario.rol === 'profesor',
      usuario_ids,
    );

    res.status(200).json({ success: true, participantes });
  } catch (error: any) {
    const status = error.message.includes('profesor') ? 403 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
};

export const eliminarParticipante = async (req: Request, res: Response): Promise<void> => {
  try {
    const { usuarioId } = req.params as { usuarioId: string };
    const usuario                 = (req as any).usuario;
    const { torneoId } = req.params as { torneoId: string };

    await torneosService.eliminarParticipante(torneoId, usuario.rol === 'profesor', usuarioId);
    res.status(200).json({ success: true, mensaje: 'Participante eliminado correctamente.' });
  } catch (error: any) {
    const status = error.message.includes('profesor') ? 403 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
};

export const listarPartidasDeTorneo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { torneoId } = req.params as { torneoId: string };
    const historial    = req.query.historial === 'true';

    const partidas = await torneosService.listarPartidasDeTorneo(torneoId, historial);
    res.status(200).json({ success: true, partidas });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const obtenerMensajesChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { torneoId } = req.params as { torneoId: string };
    const resultado = await torneosService.obtenerMensajesChat(torneoId);
    res.status(200).json({ success: true, sala_id: resultado.sala_id, mensajes: resultado.mensajes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const enviarMensajeChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { torneoId } = req.params as { torneoId: string };
    const usuario      = (req as any).usuario;
    const { contenido } = req.body;

    if (!contenido?.trim()) {
      res.status(400).json({ success: false, error: 'El mensaje no puede estar vacío.' });
      return;
    }

    const mensaje = await torneosService.enviarMensajeChat(torneoId, usuario.id, contenido.trim());
    res.status(201).json({ success: true, mensaje });
  } catch (error: any) {
    const status = error.message.includes('permiso') ? 403 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
};