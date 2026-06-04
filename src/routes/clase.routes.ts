import { Router } from 'express';
import { ClaseController } from '../controllers/clase.controller';

const router = Router();

// Creación Endpoint: POST /api/clases/crear
// Estado Endpoint: PATCH /api/clases/:id/estado
router.post('/crear', ClaseController.crearClase);
router.patch('/:id/estado', ClaseController.alternarEstado);

// Consultar información de clase Endpoint: GET /api/clases/invite/:codigo
// Unirse a clase Endpoint: POST /api/clases/join
router.get('/invite/:codigo', ClaseController.infoInvitacion); // Público: Muestra datos en la landing de invitación
router.post('/join', ClaseController.unirseAClase); // Protegido: Ejecuta la acción de unirse

// Borrar clase Endpoint: DELETE /api/clases/:id
router.delete('/:id', ClaseController.eliminarClase);

// Listar clases por profesor Endpoint: GET /api/clases/profesor/:profesorId
// Listar clases por alumno Endpoint: GET /api/clases/alumno/:alumnoId
router.get('/profesor/:profesorId', ClaseController.listarClasesPorProfesor);
router.get('/alumno/:alumnoId', ClaseController.listarClasesPorAlumno);

// Consultar información de una clase específica (Para cargar el Dashboard de la clase y el Chat) Endpoint: GET /api/clases/:id
router.get('/:id', ClaseController.obtenerClase); 

export default router;