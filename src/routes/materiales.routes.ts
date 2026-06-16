import { Router } from 'express';
import multer from 'multer';
import * as materialesController from '../controllers/materiales.controller';
import { verificarAutenticacion, verificarProfesor } from '../middlewares/auth.middleware';

const router = Router();

// Multer en memoria — los buffers se suben directamente a Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB — el service vuelve a validar por seguridad
});

// Campos esperados: "archivo" (foto/video) y "miniatura" (opcional)
const camposSubida = upload.fields([
  { name: 'archivo', maxCount: 1 },
  { name: 'miniatura', maxCount: 1 },
]);

// Campos esperados para YouTube: solo "miniatura" (opcional)
const camposYoutube = upload.fields([
  { name: 'miniatura', maxCount: 1 },
]);

// ── Subida ─────────────────────────────────────────────────
router.post('/subir', verificarAutenticacion, verificarProfesor, camposSubida, materialesController.subirArchivo);
router.post('/youtube', verificarAutenticacion, verificarProfesor, camposYoutube, materialesController.subirYoutube);

// ── Lectura ────────────────────────────────────────────────
router.get('/carpeta/:carpetaId', verificarAutenticacion, materialesController.getMaterialesDeCarpeta);
router.get('/:id', verificarAutenticacion, materialesController.getMaterial);
router.get('/:id/url', verificarAutenticacion, materialesController.getUrlMaterial);
router.get('/:id/miniatura', verificarAutenticacion, materialesController.getMiniaturaMaterial);

// ── Edición ────────────────────────────────────────────────
router.patch('/:id/visibilidad', verificarAutenticacion, verificarProfesor, materialesController.toggleVisibilidad);
router.patch('/:id/nombre', verificarAutenticacion, verificarProfesor, materialesController.renombrar);

// ── Borrado ────────────────────────────────────────────────
router.delete('/:id', verificarAutenticacion, verificarProfesor, materialesController.eliminar);

export default router;