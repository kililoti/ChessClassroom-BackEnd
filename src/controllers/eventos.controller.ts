import { Request, Response } from 'express';
import * as eventosService from '../services/eventos.service';

export const getEventos = async (req: Request, res: Response): Promise<void> => {
  try {
    const claseId = req.params.claseId as string;
    const alumnoId = req.query.alumnoId as string | undefined;
    const data = await eventosService.getEventos(claseId, alumnoId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const crearEvento = async (req: Request, res: Response): Promise<void> => {
  try {
    const creado_por = (req as any).usuario.id;
    const data = await eventosService.crearEvento({ ...req.body, creado_por });
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const eliminarEvento = async (req: Request, res: Response): Promise<void> => {
  try {
    const eventoId = req.params.eventoId as string;
    const soloEste = req.query.soloEste !== 'false'; // default true
    const desdeGrupo = req.query.desdeGrupo === 'true'; // default false
    await eventosService.eliminarEvento(eventoId, soloEste, desdeGrupo);
    res.json({ success: true, mensaje: 'Evento eliminado.' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};