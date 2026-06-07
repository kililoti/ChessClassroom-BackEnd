import { Router } from 'express';
import multer from 'multer';
import { verificarAutenticacion } from '../middlewares/auth.middleware';
import { crearCarpeta, listarCarpetas, borrarCarpeta, listarArchivosDeCarpeta, toggleVisibilidadCarpeta } from '../controllers/carpetas.controller';
import { subirArchivoPGN, descargarArchivo, toggleVisibilidadArchivo, borrarArchivo } from '../controllers/recursos.controller';

const router = Router();

// Configuración de multer (máximo 10MB en memoria)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } 
});

// RUTAS DE CARPETAS
router.post('/carpetas', verificarAutenticacion, crearCarpeta);
router.get('/carpetas', verificarAutenticacion, listarCarpetas);
router.delete('/carpetas/:id', verificarAutenticacion, borrarCarpeta);

// RUTAS DE ARCHIVOS (RECURSOS)
router.post('/upload-pgn', verificarAutenticacion, upload.single('file'), subirArchivoPGN);
router.get('/descargar/:id', verificarAutenticacion, descargarArchivo);

router.get('/archivos/:carpeta_id', verificarAutenticacion, listarArchivosDeCarpeta);

router.patch('/carpetas/:id', verificarAutenticacion, toggleVisibilidadCarpeta);
router.patch('/archivos/:id', verificarAutenticacion, toggleVisibilidadArchivo);

router.delete('/archivos/:id', verificarAutenticacion, borrarArchivo);

export default router;