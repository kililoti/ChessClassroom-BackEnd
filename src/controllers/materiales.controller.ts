import { Request, Response } from 'express';
import * as materialesService from '../services/materiales.service';

// Helper para extraer archivos de multer.fields() sin redefinir el tipo de Request
// (evitamos el conflicto de tipos con RequestHandler)
function getArchivos(req: Request): { archivo?: Express.Multer.File; miniatura?: Express.Multer.File } {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  return {
    archivo: files?.archivo?.[0],
    miniatura: files?.miniatura?.[0],
  };
}

// POST /api/materiales/subir  (multipart/form-data)
// Campos: nombre, carpeta_id, tipo ('foto' | 'video'), archivo (file), miniatura? (file)
export const subirArchivo = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuario = (req as any).usuario;
    const { nombre, carpeta_id, tipo } = req.body;

    if (!nombre || !carpeta_id || !tipo) {
      res.status(400).json({ success: false, message: 'Faltan campos obligatorios: nombre, carpeta_id, tipo.' });
      return;
    }
    if (tipo !== 'foto' && tipo !== 'video') {
      res.status(400).json({ success: false, message: 'Tipo inválido. Debe ser "foto" o "video".' });
      return;
    }

    const { archivo: archivoFile, miniatura: miniaturaFile } = getArchivos(req);

    if (!archivoFile) {
      res.status(400).json({ success: false, message: 'No se ha proporcionado ningún archivo.' });
      return;
    }

    const data = await materialesService.subirMaterialArchivo(
      archivoFile.buffer,
      archivoFile.originalname,
      archivoFile.mimetype,
      carpeta_id,
      usuario.id,
      nombre,
      tipo,
      miniaturaFile?.buffer,
      miniaturaFile?.mimetype,
    );

    res.status(201).json({ success: true, material: data });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// POST /api/materiales/youtube  (multipart/form-data por la miniatura opcional)
// Campos: nombre, carpeta_id, youtube_url, miniatura? (file)
export const subirYoutube = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuario = (req as any).usuario;
    const { nombre, carpeta_id, youtube_url } = req.body;

    if (!nombre || !carpeta_id || !youtube_url) {
      res.status(400).json({ success: false, message: 'Faltan campos obligatorios: nombre, carpeta_id, youtube_url.' });
      return;
    }

    const { miniatura: miniaturaFile } = getArchivos(req);

    const data = await materialesService.subirMaterialYoutube(
      carpeta_id,
      usuario.id,
      nombre,
      youtube_url,
      miniaturaFile?.buffer,
      miniaturaFile?.mimetype,
    );

    res.status(201).json({ success: true, material: data });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// GET /api/materiales/carpeta/:carpetaId
export const getMaterialesDeCarpeta = async (req: Request, res: Response): Promise<void> => {
  try {
    const carpetaId = req.params.carpetaId as string;
    const esProfesor = (req as any).usuario.rol === 'profesor';
    const data = await materialesService.obtenerMaterialesDeCarpeta(carpetaId, esProfesor);
    res.json({ success: true, materiales: data });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// GET /api/materiales/:id
export const getMaterial = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const esProfesor = (req as any).usuario.rol === 'profesor';
    const data = await materialesService.obtenerMaterialPorId(id, esProfesor);
    res.json({ success: true, material: data });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// GET /api/materiales/:id/url  → URL firmada del archivo (foto/vídeo)
export const getUrlMaterial = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const url = await materialesService.generarUrlMaterial(id);
    res.json({ success: true, url });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// GET /api/materiales/:id/miniatura  → URL de la miniatura (firmada, externa o null)
export const getMiniaturaMaterial = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const url = await materialesService.generarUrlMiniatura(id);
    res.json({ success: true, url });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// PATCH /api/materiales/:id/visibilidad
export const toggleVisibilidad = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { visible } = req.body;
    const data = await materialesService.actualizarVisibilidadMaterial(id, visible);
    res.json({ success: true, material: data });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// PATCH /api/materiales/:id/nombre
export const renombrar = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { nombre } = req.body;
    const data = await materialesService.renombrarMaterial(id, nombre);
    res.json({ success: true, material: data });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// DELETE /api/materiales/:id
export const eliminar = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await materialesService.eliminarMaterial(id);
    res.json({ success: true, mensaje: 'Material eliminado correctamente.' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};