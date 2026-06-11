import { Router } from 'express';
import multer from 'multer';
import { verificarAutenticacion } from '../middlewares/auth.middleware';
import {
  subirEjercicio,
  obtenerEjercicio,
  obtenerEjerciciosPorArchivo,
  actualizarSolucion,
  actualizarFechas,
  asignarEjercicio,
  listarRespuestas,
  evaluarAlumno,
  iniciarEjercicio,
  obtenerMiProgreso,
  actualizarMovimiento,
  guardarComentarioAlumno,
  guardarTiempo,
  eliminarEjercicio,
  eliminarEjerciciosEnBloque,
  toggleVisibilidadEjercicio,
} from '../controllers/ejercicios.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// PROFESOR
router.patch ('/respuestas/:respuesta_id/evaluar', verificarAutenticacion, evaluarAlumno);

// Debe ir ANTES de /:id para que Express no los confunda con un UUID
router.get   ('/archivo/:archivo_id', verificarAutenticacion, obtenerEjerciciosPorArchivo);
router.delete('/bloque',              verificarAutenticacion, eliminarEjerciciosEnBloque);

// RUTAS POR EJERCICIO UUID

// PROFESOR
router.post  ('/',                        verificarAutenticacion, upload.single('file'), subirEjercicio);
router.get   ('/:id',                     verificarAutenticacion, obtenerEjercicio);
router.patch ('/:id/solucion',            verificarAutenticacion, actualizarSolucion);
router.patch ('/:id/fechas',              verificarAutenticacion, actualizarFechas);
router.patch ('/:id/asignar',             verificarAutenticacion, asignarEjercicio);
router.get   ('/:id/respuestas',          verificarAutenticacion, listarRespuestas);
router.patch ('/:id/visibilidad',         verificarAutenticacion, toggleVisibilidadEjercicio);
router.delete('/:id',                     verificarAutenticacion, eliminarEjercicio);

// ALUMNO
router.post  ('/:id/iniciar',             verificarAutenticacion, iniciarEjercicio);
router.get   ('/:id/mi-progreso',         verificarAutenticacion, obtenerMiProgreso);
router.patch ('/:id/movimiento',          verificarAutenticacion, actualizarMovimiento);
router.patch ('/:id/comentario-alumno',   verificarAutenticacion, guardarComentarioAlumno);
router.patch ('/:id/tiempo',              verificarAutenticacion, guardarTiempo);

export default router;