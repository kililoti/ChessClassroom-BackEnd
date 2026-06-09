import { Router } from 'express';
import multer from 'multer';
import { verificarAutenticacion } from '../middlewares/auth.middleware';
import {
  subirEjercicio,
  obtenerEjercicio,
  actualizarSolucion,
  actualizarFechaEntrega,
  asignarEjercicio,
  listarRespuestas,
  evaluarAlumno,
  iniciarEjercicio,
  obtenerMiProgreso,
  actualizarMovimiento,
  guardarComentarioAlumno,
} from '../controllers/ejercicios.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// PROFESOR
router.patch('/respuestas/:respuesta_id/evaluar', verificarAutenticacion, evaluarAlumno);

// RUTAS POR ARCHIVO ID

// PROFESOR
router.post  ('/', verificarAutenticacion, upload.single('file'), subirEjercicio);
router.get   ('/:id', verificarAutenticacion, obtenerEjercicio);
router.patch ('/:id/solucion', verificarAutenticacion, actualizarSolucion);
router.patch ('/:id/fecha-entrega', verificarAutenticacion, actualizarFechaEntrega);
router.patch ('/:id/asignar', verificarAutenticacion, asignarEjercicio);
router.get   ('/:id/respuestas', verificarAutenticacion, listarRespuestas);

// ALUMNO
router.post  ('/:id/iniciar', verificarAutenticacion, iniciarEjercicio);
router.get   ('/:id/mi-progreso', verificarAutenticacion, obtenerMiProgreso);
router.patch ('/:id/movimiento', verificarAutenticacion, actualizarMovimiento);
router.patch ('/:id/comentario-alumno', verificarAutenticacion, guardarComentarioAlumno);

export default router;