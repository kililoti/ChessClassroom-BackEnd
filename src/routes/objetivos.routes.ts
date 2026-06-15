import { Router } from 'express';
import * as objetivosController from '../controllers/objetivos.controller';
import { verificarAutenticacion, verificarProfesor, verificarProfesorDeClase } from '../middlewares/auth.middleware';

const router = Router();

// ─── Tablones ───────────────────────────────────────────────────────────────

// Obtener todos los tablones de una clase (profesor ve todos, alumno solo los suyos via RLS)
router.get(
  '/tablones/:claseId',
  verificarAutenticacion,
  objetivosController.getTablerosPorClase
);

// Crear un nuevo tablón (solo profesor de esa clase)
router.post(
  '/tablones',
  verificarAutenticacion,
  verificarProfesor,
  verificarProfesorDeClase,
  objetivosController.crearTablon
);

// Eliminar un tablón (solo profesor)
router.delete(
  '/tablones/:tablonId',
  verificarAutenticacion,
  verificarProfesor,
  objetivosController.eliminarTablon
);

// ─── Objetivos ───────────────────────────────────────────────────────────────

// Crear un objetivo dentro de un tablón (solo profesor)
router.post(
  '/:tablonId',
  verificarAutenticacion,
  verificarProfesor,
  objetivosController.crearObjetivo
);

// Marcar/desmarcar un objetivo como completado (solo profesor)
router.patch(
  '/:objetivoId/toggle',
  verificarAutenticacion,
  verificarProfesor,
  objetivosController.toggleObjetivo
);

// Eliminar un objetivo (solo profesor)
router.delete(
  '/:objetivoId',
  verificarAutenticacion,
  verificarProfesor,
  objetivosController.eliminarObjetivo
);

router.patch('/tablones/:tablonId', verificarAutenticacion, verificarProfesor, objetivosController.editarTablon);
router.post('/grupo/:claseId/:tablonTitulo', verificarAutenticacion, verificarProfesor, objetivosController.crearObjetivoGrupal);

export default router;