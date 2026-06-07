import { Request, Response } from 'express';
import * as carpetasService from '../services/carpetas.service';
import { supabaseAdmin } from '../config/supabase';
import * as recursosService from '../services/recursos.service';

export const crearCarpeta = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, modulo, clase_id, carpeta_padre_id, visible } = req.body;
    const profesor_id = (req as any).usuario?.id; 

    if (!profesor_id) {
      res.status(401).json({ success: false, error: 'No autorizado.' });
      return;
    }
    if (!nombre || !modulo || !clase_id) {
      res.status(400).json({ success: false, error: 'Faltan datos obligatorios.' });
      return;
    }

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

    if (!clase_id || !modulo) {
      res.status(400).json({ success: false, error: 'Faltan parámetros de búsqueda.' });
      return;
    }

    // AHORA ESTO ES SEGURO Y LIMPIO
    const esProfesor = usuario.rol === 'profesor';

    const carpetas = await carpetasService.obtenerCarpetas(
      clase_id as string, 
      modulo as string, 
      carpeta_padre_id as string | undefined, 
      esProfesor
    );
    
    res.status(200).json({ success: true, carpetas });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const borrarCarpeta = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Validar que el ID exista y sea estrictamente un string
    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de carpeta inválido.' });
      return;
    }

    await carpetasService.eliminarCarpeta(id);
    
    res.status(200).json({ success: true, message: 'Carpeta eliminada.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const listarArchivosDeCarpeta = async (req: Request, res: Response): Promise<void> => {
  try {
    const { carpeta_id } = req.params;
    const usuario = (req as any).usuario;

    // Extraemos el rol gracias a que el middleware ya nos lo da masticado
    const esProfesor = usuario?.rol === 'profesor';

    // TYPE GUARD: Validamos que el ID exista y sea estrictamente un string
    if (!carpeta_id || typeof carpeta_id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }
    // Llama a tu servicio (asegúrate de que el nombre de la función sea el correcto)
    // Nota: Si tu función en el servicio se llama distinto, cámbialo aquí
    const archivos = await recursosService.obtenerArchivosDeCarpeta(carpeta_id, esProfesor);
    
    res.status(200).json({ success: true, archivos });
  } catch (error: any) {
    console.error("Error en listarArchivosDeCarpeta:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const toggleVisibilidadCarpeta = async (req: Request, res: Response): Promise<void> => {
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

    const carpetaActualizada = await carpetasService.actualizarVisibilidadCarpeta(id, visible);
    
    res.status(200).json({ success: true, carpeta: carpetaActualizada });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};