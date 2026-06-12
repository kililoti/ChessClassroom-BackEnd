import { Router } from 'express';
import { ClaseController } from '../controllers/clase.controller';
import { getAlumnos, actualizarAlias, expulsarAlumno } from '../controllers/alumnos.controller';
import { verificarAutenticacion, verificarProfesor, verificarProfesorDeClase } from '../middlewares/auth.middleware';
 
const router = Router();
 
// Creación Endpoint: POST /api/clases/crear
// Estado Endpoint: PATCH /api/clases/:id/estado
router.post('/crear', ClaseController.crearClase);
router.patch('/:id/estado', ClaseController.alternarEstado);
 
// Consultar información de clase Endpoint: GET /api/clases/invite/:codigo
// Unirse a clase Endpoint: POST /api/clases/join
router.get('/invite/:codigo', ClaseController.infoInvitacion);
router.post('/join', ClaseController.unirseAClase);
 
// Borrar clase Endpoint: DELETE /api/clases/:id
router.delete('/:id', ClaseController.eliminarClase);
 
// Listar clases por profesor Endpoint: GET /api/clases/profesor/:profesorId
// Listar clases por alumno Endpoint: GET /api/clases/alumno/:alumnoId
router.get('/profesor/:profesorId', ClaseController.listarClasesPorProfesor);
router.get('/alumno/:alumnoId', ClaseController.listarClasesPorAlumno);
 
// ── Gestión de alumnos ────────────────────────────────────
router.get('/:claseId/alumnos', verificarAutenticacion, getAlumnos);
router.patch('/:claseId/alumnos/:alumnoId/alias', verificarAutenticacion, verificarProfesor, verificarProfesorDeClase, actualizarAlias);
router.delete('/:claseId/alumnos/:alumnoId', verificarAutenticacion, verificarProfesor, verificarProfesorDeClase, expulsarAlumno);
 
// Consultar información de una clase específica Endpoint: GET /api/clases/:id
// OJO: esta ruta debe ir SIEMPRE al final para no interceptar las rutas con subrutas
router.get('/:id', ClaseController.obtenerClase);
 
export default router;