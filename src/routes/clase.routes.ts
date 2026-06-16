import { Router } from 'express';
import { ClaseController } from '../controllers/clase.controller';
//import { getAlumnos, actualizarAlias, expulsarAlumno } from '../controllers/alumnos.controller';
import { verificarAutenticacion, verificarProfesor, verificarProfesorDeClase } from '../middlewares/auth.middleware';

const router = Router();

router.post('/crear', ClaseController.crearClase);
router.patch('/:id/estado', ClaseController.alternarEstado);

router.get('/invite/:codigo', ClaseController.infoInvitacion);
router.post('/join', ClaseController.unirseAClase);

router.delete('/:id', ClaseController.eliminarClase);

router.get('/profesor/:profesorId', ClaseController.listarClasesPorProfesor);
router.get('/alumno/:alumnoId', ClaseController.listarClasesPorAlumno);

router.get('/:id', ClaseController.obtenerClase);

// Nuevo endpoint: listar alumnos de una clase
router.get('/:claseId/alumnos', verificarAutenticacion, ClaseController.listarAlumnosPorClase);
router.get('/:claseId/miembros', verificarAutenticacion, ClaseController.listarMiembrosPorClase);
// ── Gestión de alumnos ────────────────────────────────────


export default router;