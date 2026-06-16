import { Request, Response } from 'express';
import * as carpetasService from '../services/carpetas.service';
import * as recursosService from '../services/recursos.service';

export const crearCarpeta = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, modulo, clase_id, carpeta_padre_id, visible } = req.body;
    const profesor_id = (req as any).usuario?.id;

    if (!profesor_id) { res.status(401).json({ success: false, error: 'No autorizado.' }); return; }
    if (!nombre || !modulo || !clase_id) { res.status(400).json({ success: false, error: 'Faltan datos obligatorios.' }); return; }

    const nuevaCarpeta = await carpetasService.crearCarpeta(
      nombre, modulo, profesor_id, clase_id, carpeta_padre_id, visible
    );
    res.status(201).json({ success: true, carpeta: nuevaCarpeta });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const listarCarpetas = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clase_id, modulo, carpeta_padre_id } = req.query;
    const usuario = (req as any).usuario;

    if (!clase_id || !modulo) { res.status(400).json({ success: false, error: 'Faltan parámetros.' }); return; }

    const esProfesor = usuario?.rol === 'profesor';
    const carpetas = await carpetasService.obtenerCarpetas(
      clase_id as string, modulo as string, carpeta_padre_id as string | undefined, esProfesor
    );
    res.status(200).json({ success: true, carpetas });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const obtenerCarpeta = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') { res.status(400).json({ success: false, error: 'ID inválido.' }); return; }
    const carpeta = await carpetasService.obtenerCarpetaPorId(id);
    res.status(200).json({ success: true, carpeta });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
};

export const obtenerAncestros = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') { res.status(400).json({ success: false, error: 'ID inválido.' }); return; }
    const ancestros = await carpetasService.obtenerAncestrosCarpeta(id);
    res.status(200).json({ success: true, ancestros });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const obtenerSalaCarpeta = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') { res.status(400).json({ success: false, error: 'ID inválido.' }); return; }
    const salaId = await carpetasService.obtenerSalaCarpeta(id);
    res.status(200).json({ success: true, salaId });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const borrarCarpeta = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') { res.status(400).json({ success: false, error: 'ID inválido.' }); return; }
    await carpetasService.eliminarCarpeta(id);
    res.status(200).json({ success: true, message: 'Carpeta eliminada.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const listarArchivosDeCarpeta = async (req: Request, res: Response): Promise<void> => {
  try {
    const { carpeta_id } = req.params;
    const { modulo } = req.query;
    const esProfesor = (req as any).usuario?.rol === 'profesor';
    const usuarioId = (req as any).usuario?.id;

    if (!carpeta_id || typeof carpeta_id !== 'string') { res.status(400).json({ success: false, error: 'ID inválido.' }); return; }
    const archivos = await recursosService.obtenerArchivosDeCarpeta(
        carpeta_id, 
        esProfesor, 
        usuarioId,
        modulo as string
    );
    res.status(200).json({ success: true, archivos });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const toggleVisibilidadCarpeta = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { visible } = req.body;
    if (typeof visible !== 'boolean') { res.status(400).json({ success: false, error: '"visible" debe ser booleano.' }); return; }
    if (!id || typeof id !== 'string') { res.status(400).json({ success: false, error: 'ID inválido.' }); return; }
    const carpetaActualizada = await carpetasService.actualizarVisibilidadCarpeta(id, visible);
    res.status(200).json({ success: true, carpeta: carpetaActualizada });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};