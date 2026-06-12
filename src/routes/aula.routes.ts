import { Router } from 'express';
import { verificarAutenticacion, verificarProfesorDeAula } from '../middlewares/auth.middleware';
import * as AulaController from '../controllers/aula.controller';

const router = Router();

router.use(verificarAutenticacion);

// Cualquier miembro de la clase puede obtener el aula
router.get('/clase/:claseId', AulaController.obtenerOCrearAula);
router.get('/:aulaId',        AulaController.obtenerAula);
router.get('/:aulaId/permisos', AulaController.obtenerPermisosAula);

// Solo el profesor puede modificar
router.patch('/:aulaId/tablero',     verificarProfesorDeAula, AulaController.actualizarTablero);
router.patch('/:aulaId/orientacion', verificarProfesorDeAula, AulaController.actualizarOrientacion);
router.patch('/:aulaId/cerrar',      verificarProfesorDeAula, AulaController.cerrarAula);

// Permisos — solo profesor
router.put('/:aulaId/permisos/:alumnoId',    verificarProfesorDeAula, AulaController.actualizarPermisosAlumno);
router.delete('/:aulaId/permisos/:alumnoId', verificarProfesorDeAula, AulaController.eliminarPermisosAlumno);

export default router;