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
    
    // TYPE GUARD: Validamos que el ID exista y sea estrictamente un string
    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }
    
    // Al pasar el Type Guard, TypeScript ya sabe que es un string y deja de quejarse
    const urlFirmada = await recursosService.generarUrlDescarga(id);

    res.status(200).json({ success: true, url: urlFirmada });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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

    // TYPE GUARD: Validamos que el ID exista y sea estrictamente un string
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

    // Validación de seguridad extra: solo el profesor puede borrar
    if (usuario?.rol !== 'profesor') {
      res.status(403).json({ success: false, error: 'No tienes permisos para eliminar archivos.' });
      return;
    }

    // TYPE GUARD: Validamos que el ID exista y sea estrictamente un string
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