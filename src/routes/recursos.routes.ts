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
  eliminarPartidaArchivo, eliminarPartidasArchivo, toggleVisibilidadPartidaArchivo,
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
// Bulk delete (array de índices) — antes de la ruta con :partida_index
router.delete ('/archivos/:archivo_id/partidas', verificarAutenticacion, eliminarPartidasArchivo);
// Toggle visibilidad partida individual
router.patch  ('/archivos/:archivo_id/partida/:partida_index/visibilidad', verificarAutenticacion, toggleVisibilidadPartidaArchivo);
// Delete individual partida
router.delete ('/archivos/:archivo_id/partida/:partida_index', verificarAutenticacion, eliminarPartidaArchivo);
router.get    ('/archivos/:id', verificarAutenticacion, obtenerArchivo);
router.patch  ('/archivos/:id', verificarAutenticacion, toggleVisibilidadArchivo);
router.delete ('/archivos/:id', verificarAutenticacion, borrarArchivo);
router.post   ('/upload-pgn', verificarAutenticacion, upload.single('file'), subirArchivoPGN);
router.get    ('/descargar/:id', verificarAutenticacion, descargarArchivo);

export default router;