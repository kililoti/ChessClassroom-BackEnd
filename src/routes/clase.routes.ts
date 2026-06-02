import { Router } from 'express';
import { ClaseController } from '../controllers/clase.controller';

const router = Router();

// Creación y gestión
router.post('/crear', ClaseController.crearClase);
router.patch('/:id/estado', ClaseController.alternarEstado);

// Sistema de Invitaciones
router.get('/invite/:codigo', ClaseController.infoInvitacion); // Público: Muestra datos en la landing de invitación
router.post('/join', ClaseController.unirseAClase); // Protegido: Ejecuta la acción de unirse

// Borrar clase
router.delete('/:id', ClaseController.eliminarClase);

// Listar clases por profesor o alumno
router.get('/profesor/:profesorId', ClaseController.listarClasesPorProfesor);
router.get('/alumno/:alumnoId', ClaseController.listarClasesPorAlumno);

export default router;