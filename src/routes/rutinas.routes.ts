import { Router } from 'express';
import * as rutinasController from '../controllers/rutinas.controller';
import * as eventosController from '../controllers/eventos.controller';
import { verificarAutenticacion, verificarProfesor, verificarProfesorDeClase } from '../middlewares/auth.middleware';

const router = Router();

// ── Eventos calendario ────────────────────────────────────
router.get('/eventos/:claseId', verificarAutenticacion, eventosController.getEventos);
router.post('/eventos', verificarAutenticacion, verificarProfesor, verificarProfesorDeClase, eventosController.crearEvento);
router.delete('/eventos/:eventoId', verificarAutenticacion, verificarProfesor, eventosController.eliminarEvento);

// ── Checklist rutinas ─────────────────────────────────────
router.get('/checklist/:claseId', verificarAutenticacion, rutinasController.getChecklist);
router.post('/checklist', verificarAutenticacion, verificarProfesor, verificarProfesorDeClase, rutinasController.crearRutina);
router.delete('/checklist/:rutinaId', verificarAutenticacion, verificarProfesor, rutinasController.eliminarRutina);
router.patch('/checklist/:semanaId/toggle', verificarAutenticacion, verificarProfesor, rutinasController.toggleSemana);

// ── Notificaciones ────────────────────────────────────────
router.get('/notificaciones/:usuarioId', verificarAutenticacion, rutinasController.getNotificaciones);
router.patch('/notificaciones/:notificacionId/leer', verificarAutenticacion, rutinasController.marcarLeida);
router.patch('/notificaciones/:usuarioId/leer-todas', verificarAutenticacion, rutinasController.marcarTodasLeidas);

export default router;