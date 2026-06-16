import { Router } from 'express';
import { getAlumnos, actualizarAlias, expulsarAlumno } from '../controllers/alumnos.controller';
import { verificarAutenticacion, verificarProfesor, verificarProfesorDeClase } from '../middlewares/auth.middleware';

const router = Router();

// GET /api/clases/:claseId/alumnos  — profesor y alumnos pueden ver la lista
router.get(
  '/:claseId/alumnos',
  verificarAutenticacion,
  getAlumnos
);

// PATCH /api/clases/:claseId/alumnos/:alumnoId/alias
router.patch(
  '/:claseId/alumnos/:alumnoId/alias',
  verificarAutenticacion,
  verificarProfesor,
  verificarProfesorDeClase,
  actualizarAlias
);

// DELETE /api/clases/:claseId/alumnos/:alumnoId
router.delete(
  '/:claseId/alumnos/:alumnoId',
  verificarAutenticacion,
  verificarProfesor,
  verificarProfesorDeClase,
  expulsarAlumno
);

export default router;