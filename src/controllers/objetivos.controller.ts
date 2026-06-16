import { Request, Response } from 'express';
import * as objetivosService from '../services/objetivos.service';

export const getTablerosPorClase = async (req: Request, res: Response): Promise<void> => {
  try {
    const claseId = req.params.claseId as string;
    const alumnoId = req.query.alumnoId as string | undefined;
    const data = await objetivosService.getTableros(claseId, alumnoId);
    res.json(data);
  } catch (error) {
    console.error('Error en getTablerosPorClase:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const crearTablon = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clase_id, alumno_id, titulo, descripcion, fecha_limite } = req.body;
    const creado_por = (req as any).usuario.id;

    const data = await objetivosService.crearTablon({
      clase_id,
      alumno_id: alumno_id ?? null,
      titulo,
      descripcion: descripcion ?? null,
      fecha_limite: fecha_limite ?? null,
      creado_por,
    });
    res.status(201).json(data);
  } catch (error) {
    console.error('Error en crearTablon:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const eliminarTablon = async (req: Request, res: Response): Promise<void> => {
  try {
    const tablonId = req.params.tablonId as string;
    await objetivosService.eliminarTablon(tablonId);
    res.json({ success: true, mensaje: 'Tablón eliminado correctamente.' });
  } catch (error) {
    console.error('Error en eliminarTablon:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const crearObjetivo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { titulo, fecha_limite } = req.body;
    const tablonId = req.params.tablonId as string;

    const data = await objetivosService.crearObjetivo({
      tablon_id: tablonId,
      titulo,
      fecha_limite: fecha_limite ?? null,
    });
    res.status(201).json(data);
  } catch (error) {
    console.error('Error en crearObjetivo:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const toggleObjetivo = async (req: Request, res: Response): Promise<void> => {
  try {
    const objetivoId = req.params.objetivoId as string;
    const data = await objetivosService.toggleObjetivo(objetivoId);
    res.json(data);
  } catch (error) {
    console.error('Error en toggleObjetivo:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const eliminarObjetivo = async (req: Request, res: Response): Promise<void> => {
  try {
    const objetivoId = req.params.objetivoId as string;
    await objetivosService.eliminarObjetivo(objetivoId);
    res.json({ success: true, mensaje: 'Objetivo eliminado correctamente.' });
  } catch (error) {
    console.error('Error en eliminarObjetivo:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const editarTablon = async (req: Request, res: Response): Promise<void> => {
  try {
    const tablonId = req.params.tablonId as string;
    const { titulo, descripcion, fecha_limite } = req.body;
    const data = await objetivosService.editarTablon(tablonId, { titulo, descripcion, fecha_limite });
    res.json(data);
  } catch (error) {
    console.error('Error en editarTablon:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const crearObjetivoGrupal = async (req: Request, res: Response): Promise<void> => {
  try {
    const claseId = req.params.claseId as string;
    const tablonTitulo = decodeURIComponent(req.params.tablonTitulo as string);
    const { titulo, fecha_limite } = req.body;

    await objetivosService.crearObjetivoGrupal(tablonTitulo, claseId, titulo, fecha_limite ?? null);
    res.status(201).json({ success: true, mensaje: 'Objetivo añadido a todos los alumnos.' });
  } catch (error) {
    console.error('Error en crearObjetivoGrupal:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};