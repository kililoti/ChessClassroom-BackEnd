import { Router } from 'express';
import multer from 'multer';
import { verificarAutenticacion } from '../middlewares/auth.middleware';
import {
  crearCarpeta, listarCarpetas, obtenerCarpeta, obtenerAncestros,
  obtenerSalaCarpeta, borrarCarpeta, listarArchivosDeCarpeta, toggleVisibilidadCarpeta,
} from '../controllers/carpetas.controller';
import {
  subirArchivoPGN, descargarArchivo, obtenerArchivo,
  toggleVisibilidadArchivo, borrarArchivo,
} from '../controllers/recursos.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// CARPETAS
router.post   ('/carpetas', verificarAutenticacion, crearCarpeta);
router.get    ('/carpetas', verificarAutenticacion, listarCarpetas);

router.get    ('/carpetas/ancestros/:id', verificarAutenticacion, obtenerAncestros);
router.get    ('/carpetas/:id/sala-chat', verificarAutenticacion, obtenerSalaCarpeta);
router.get    ('/carpetas/:id', verificarAutenticacion, obtenerCarpeta);
router.patch  ('/carpetas/:id', verificarAutenticacion, toggleVisibilidadCarpeta);
router.delete ('/carpetas/:id', verificarAutenticacion, borrarCarpeta);

// ARCHIVOS
router.get    ('/archivos/carpeta/:carpeta_id', verificarAutenticacion, listarArchivosDeCarpeta);
router.get    ('/archivos/:id', verificarAutenticacion, obtenerArchivo);
router.patch  ('/archivos/:id', verificarAutenticacion, toggleVisibilidadArchivo);
router.delete ('/archivos/:id', verificarAutenticacion, borrarArchivo);

router.post   ('/upload-pgn', verificarAutenticacion, upload.single('file'), subirArchivoPGN);
router.get    ('/descargar/:id', verificarAutenticacion, descargarArchivo);

export default router;