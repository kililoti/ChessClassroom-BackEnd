import { Request, Response } from 'express';
import * as invitacionesService from '../services/invitaciones.service';

export const crearInvitacion = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuario = (req as any).usuario;
    const { partida_id, para_usuario_id } = req.body;

    if (!partida_id || !para_usuario_id) {
      res.status(400).json({ success: false, error: 'Faltan campos obligatorios.' });
      return;
    }

    const invitacion = await invitacionesService.crearInvitacion(
      partida_id,
      usuario.id,
      para_usuario_id,
    );

    res.status(201).json({ success: true, invitacion });
  } catch (error: any) {
    const status = error.message.includes('ti mismo') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
};

export const responderInvitacion = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuario        = (req as any).usuario;
    const { id }         = req.params as { id: string };
    const { accion }     = req.body; // 'aceptar' | 'rechazar'

    if (!['aceptar', 'rechazar'].includes(accion)) {
      res.status(400).json({ success: false, error: 'Acción inválida. Usa "aceptar" o "rechazar".' });
      return;
    }

    const resultado = await invitacionesService.responderInvitacion(id, usuario.id, accion);
    res.status(200).json({ success: true, ...resultado });
  } catch (error: any) {
    const status = error.message.includes('no es para ti') ? 403
                 : error.message.includes('no encontrada')  ? 404
                 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
};

export const listarInvitacionesPendientes = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuario = (req as any).usuario;
    const invitaciones = await invitacionesService.listarInvitacionesPendientes(usuario.id);
    res.status(200).json({ success: true, invitaciones });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};