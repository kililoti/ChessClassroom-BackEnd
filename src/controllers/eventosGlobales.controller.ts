import { Request, Response } from 'express';
import { getEventosGlobalesUsuario } from '../services/eventosGlobales.service';

export const getEventosGlobales = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuario = (req as any).usuario;
    const anio    = parseInt(req.query.anio as string) || new Date().getFullYear();
    const mes     = parseInt(req.query.mes  as string) || new Date().getMonth();

    const eventos = await getEventosGlobalesUsuario(usuario.id, usuario.rol, anio, mes);
    res.json({ success: true, eventos });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};