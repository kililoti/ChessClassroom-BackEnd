import { Request, Response } from 'express';
import * as AulaService from '../services/aula.service';

export const obtenerOCrearAula = async (req: Request, res: Response) => {
  try {
    const { claseId } = req.params as { claseId: string };
    const usuarioId = (req as any).usuario.id;
    const aula = await AulaService.obtenerOCrearAula(claseId, usuarioId);
    res.json(aula);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const obtenerAula = async (req: Request, res: Response) => {
  try {
    const { aulaId } = req.params as { aulaId: string };
    const aula = await AulaService.obtenerAula(aulaId);
    res.json(aula);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const actualizarTablero = async (req: Request, res: Response) => {
  try {
    const { aulaId } = req.params as { aulaId: string };
    const { fen, pgn } = req.body;
    const aula = await AulaService.actualizarTablero(aulaId, fen, pgn);
    res.json(aula);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const actualizarOrientacion = async (req: Request, res: Response) => {
  try {
    const { aulaId } = req.params as { aulaId: string };
    const { orientacion } = req.body;
    if (!['white', 'black'].includes(orientacion)) {
      return res.status(400).json({ error: 'Orientación inválida' });
    }
    const aula = await AulaService.actualizarOrientacion(aulaId, orientacion);
    res.json(aula);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const cerrarAula = async (req: Request, res: Response) => {
  try {
    const { aulaId } = req.params as { aulaId: string };
    const aula = await AulaService.cerrarAula(aulaId);
    res.json(aula);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const obtenerPermisosAula = async (req: Request, res: Response) => {
  try {
    const { aulaId } = req.params as { aulaId: string };
    const permisos = await AulaService.obtenerPermisosAula(aulaId);
    res.json(permisos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const actualizarPermisosAlumno = async (req: Request, res: Response) => {
  try {
    const { alumnoId } = req.params as { alumnoId: string };
    const { puede_mover_blancas, puede_mover_negras } = req.body;
    const { aulaId } = req.params as { aulaId: string };
    const permisos = await AulaService.actualizarPermisosAlumno(
      aulaId,
      alumnoId,
      puede_mover_blancas ?? false,
      puede_mover_negras ?? false
    );
    res.json(permisos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const eliminarPermisosAlumno = async (req: Request, res: Response) => {
  try {
    const { alumnoId } = req.params as { alumnoId: string };
    const { aulaId } = req.params as { aulaId: string };
    await AulaService.eliminarPermisosAlumno(aulaId, alumnoId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};