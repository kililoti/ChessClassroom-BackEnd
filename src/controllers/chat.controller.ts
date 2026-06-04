import { Request, Response } from 'express';
import { ChatService } from '../services/chat.service';

export class ChatController {
  
  static async getMisSalas(req: Request, res: Response): Promise<void> {
    try {
      // Extraer el ID del usuario autenticado
      const usuarioId = (req as any).usuario.id; 

      const salas = await ChatService.obtenerMisSalas(usuarioId);
      
      res.status(200).json({ success: true, data: salas });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getMensajes(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = (req as any).usuario.id;
      // Extraer especificando que es un string
      const salaId = req.params.salaId as string; 

      if (!salaId) {
        res.status(400).json({ success: false, message: 'Falta el ID de la sala' });
        return;
      }

      const mensajes = await ChatService.obtenerMensajes(salaId, usuarioId);
      
      res.status(200).json({ success: true, data: mensajes });
    } catch (error: any) {
      const statusCode = error.message.includes('Acceso denegado') ? 403 : 400;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  static async postMensaje(req: Request, res: Response): Promise<void> {
    try {
      const remitenteId = (req as any).usuario.id;
      // Extraer especificando que es un string
      const salaId = req.params.salaId as string; 
      const { contenido } = req.body;

      if (!salaId || !contenido) {
        res.status(400).json({ success: false, message: 'La sala y el contenido son obligatorios' });
        return;
      }

      const mensajeGuardado = await ChatService.enviarMensaje(salaId, remitenteId, contenido);
      
      res.status(201).json({ success: true, data: mensajeGuardado });
    } catch (error: any) {
      const statusCode = error.message.includes('Acceso denegado') ? 403 : 400;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }
}