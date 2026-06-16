import { Request, Response } from 'express';
import * as datosService from '../services/datos.service';

export const getRendimientoEjercicios = async (req: Request, res: Response): Promise<void> => {
  try {
    const alumnoId = req.params.alumnoId as string;
    const claseId  = req.query.clase_id as string;

    if (!claseId) {
      res.status(400).json({ success: false, error: 'Falta clase_id' });
      return;
    }

    const datos = await datosService.obtenerRendimientoEjercicios(alumnoId, claseId);
    res.json({ success: true, datos });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getRendimientoPartidas = async (req: Request, res: Response): Promise<void> => {
  try {
    const alumnoId = req.params.alumnoId as string;
    const claseId  = req.query.clase_id as string;

    if (!claseId) {
      res.status(400).json({ success: false, error: 'Falta clase_id' });
      return;
    }

    const datos = await datosService.obtenerRendimientoPartidas(alumnoId, claseId);
    res.json({ success: true, datos });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAlumnosDeClase = async (req: Request, res: Response): Promise<void> => {
  try {
    const claseId = req.params.claseId as string;
    const alumnos = await datosService.obtenerAlumnosDeClase(claseId);
    res.json({ success: true, alumnos });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};