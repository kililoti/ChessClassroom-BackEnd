import { Request, Response } from 'express';
import { ClaseService } from '../services/clase.service';
import * as alumnosService from '../services/alumnos.service';

// GET /api/clases/:claseId/alumnos
export const getAlumnos = async (req: Request, res: Response): Promise<void> => {
  try {
    const claseId = req.params.claseId as string;
    const data = await ClaseService.getAlumnos(claseId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// PATCH /api/clases/:claseId/alumnos/:alumnoId/alias
export const actualizarAlias = async (req: Request, res: Response): Promise<void> => {
  try {
    const claseId = req.params.claseId as string;
    const alumnoId = req.params.alumnoId as string;
    const { alias } = req.body;
    const data = await alumnosService.actualizarAlias(claseId, alumnoId, alias ?? null);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// DELETE /api/clases/:claseId/alumnos/:alumnoId
export const expulsarAlumno = async (req: Request, res: Response): Promise<void> => {
  try {
    const claseId = req.params.claseId as string;
    const alumnoId = req.params.alumnoId as string;
    await alumnosService.expulsarAlumno(claseId, alumnoId);
    res.json({ success: true, mensaje: 'Alumno expulsado de la clase.' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};