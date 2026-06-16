import { Request, Response } from 'express';
import * as rutinasService from '../services/rutinas.service';
 
export const getChecklist = async (req: Request, res: Response): Promise<void> => {
  try {
    const claseId = req.params.claseId as string;
    const alumnoId = req.query.alumnoId as string | undefined;
    const semanaInicio = req.query.semanaInicio as string | undefined;
    const mesAnio = req.query.mesAnio as string | undefined; // nuevo: "YYYY-MM"
    const data = await rutinasService.getChecklist(claseId, alumnoId, semanaInicio, mesAnio);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
 
export const crearRutina = async (req: Request, res: Response): Promise<void> => {
  try {
    const creado_por = (req as any).usuario.id;
    const data = await rutinasService.crearRutina({ ...req.body, creado_por });
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
 
export const eliminarRutina = async (req: Request, res: Response): Promise<void> => {
  try {
    await rutinasService.eliminarRutina(req.params.rutinaId as string);
    res.json({ success: true, mensaje: 'Rutina eliminada correctamente.' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
 
export const toggleSemana = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await rutinasService.toggleSemana(req.params.semanaId as string);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
 
export const getNotificaciones = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await rutinasService.getNotificaciones(req.params.usuarioId as string);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
 
export const marcarLeida = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await rutinasService.marcarLeida(req.params.notificacionId as string);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
 
export const marcarTodasLeidas = async (req: Request, res: Response): Promise<void> => {
  try {
    await rutinasService.marcarTodasLeidas(req.params.usuarioId as string);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};