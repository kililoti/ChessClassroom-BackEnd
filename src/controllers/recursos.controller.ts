import { Request, Response } from 'express';
import * as recursosService from '../services/recursos.service';

export const subirArchivoPGN = async (req: Request, res: Response): Promise<void> => {
  try {
    const { carpeta_id, categoria, nombre, visible } = req.body;
    const profesor_id = (req as any).usuario?.id;
    const archivo = req.file;

    if (!profesor_id) {
      res.status(401).json({ success: false, error: 'No autorizado.' });
      return;
    }
    if (!archivo || !carpeta_id || !categoria) {
      res.status(400).json({ success: false, error: 'Faltan datos obligatorios o el archivo.' });
      return;
    }

    const isVisible = visible !== undefined ? visible === 'true' || visible === true : true;

    const recurso = await recursosService.procesarYSubirPGN(
      archivo.buffer, archivo.originalname, archivo.mimetype,
      carpeta_id, profesor_id, categoria, nombre, isVisible
    );

    res.status(201).json({ success: true, mensaje: 'Archivo subido con éxito', recurso });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const descargarArchivo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }

    const urlFirmada = await recursosService.generarUrlDescarga(id);
    res.status(200).json({ success: true, url: urlFirmada });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const obtenerArchivo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const usuario    = (req as any).usuario;
    const esProfesor = usuario?.rol === 'profesor';

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }

    const archivo = await recursosService.obtenerArchivoPorId(id, esProfesor);
    res.status(200).json({ success: true, archivo });
  } catch (error: any) {
    const status = error.message.includes('permiso') ? 403 : 404;
    res.status(status).json({ success: false, error: error.message });
  }
};

export const toggleVisibilidadArchivo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { visible } = req.body;

    if (typeof visible !== 'boolean') {
      res.status(400).json({ success: false, error: 'El campo "visible" debe ser un booleano.' });
      return;
    }
    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }

    const archivoActualizado = await recursosService.actualizarVisibilidadArchivo(id, visible);
    res.status(200).json({ success: true, archivo: archivoActualizado });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const borrarArchivo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const usuario = (req as any).usuario;

    if (usuario?.rol !== 'profesor') {
      res.status(403).json({ success: false, error: 'No tienes permisos para eliminar archivos.' });
      return;
    }
    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }

    await recursosService.eliminarArchivo(id);
    res.status(200).json({ success: true, message: 'Archivo eliminado correctamente.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Eliminar múltiples partidas de una database (modo estudio, optimizado)
export const eliminarPartidasArchivo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { archivo_id } = req.params;
    const { indices }    = req.body; // array de números
    const usuario        = (req as any).usuario;

    if (usuario?.rol !== 'profesor') {
      res.status(403).json({ success: false, error: 'No tienes permisos.' }); return;
    }
    if (!archivo_id || !Array.isArray(indices) || indices.length === 0) {
      res.status(400).json({ success: false, error: 'Parámetros inválidos.' }); return;
    }
    if (!archivo_id || typeof archivo_id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }
    const resultado = await recursosService.eliminarPartidasDeArchivoEstudio(archivo_id, indices.map(Number));
    res.status(200).json({ success: true, ...resultado });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Toggle visibilidad de partida individual en database de estudio
export const toggleVisibilidadPartidaArchivo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.params.partida_index || typeof req.params.partida_index !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }
    const { archivo_id } = req.params;
    const partida_index  = parseInt(req.params.partida_index, 10);
    const usuario        = (req as any).usuario;

    if (usuario?.rol !== 'profesor') {
      res.status(403).json({ success: false, error: 'No tienes permisos.' }); return;
    }
    if (!archivo_id || isNaN(partida_index)) {
      res.status(400).json({ success: false, error: 'Parámetros inválidos.' }); return;
    }
    if (!archivo_id || typeof archivo_id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }
    const resultado = await recursosService.toggleVisibilidadPartida(archivo_id, partida_index);
    res.status(200).json({ success: true, ...resultado });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Eliminar una partida individual de una database (modo estudio)
export const eliminarPartidaArchivo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.params.partida_index || typeof req.params.partida_index !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }
    const { archivo_id }  = req.params;
    const partida_index   = parseInt(req.params.partida_index, 10);
    const usuario         = (req as any).usuario;

    if (usuario?.rol !== 'profesor') {
      res.status(403).json({ success: false, error: 'No tienes permisos para eliminar partidas.' });
      return;
    }
    if (!archivo_id || isNaN(partida_index)) {
      res.status(400).json({ success: false, error: 'Parámetros inválidos.' });
      return;
    }
    if (!archivo_id || typeof archivo_id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }
    const resultado = await recursosService.eliminarPartidaDeArchivoEstudio(archivo_id, partida_index);
    res.status(200).json({ success: true, ...resultado });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};