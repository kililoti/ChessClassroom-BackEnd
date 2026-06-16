import { Router } from 'express';
import { verificarAutenticacion } from '../middlewares/auth.middleware';
import {
  crearTorneo,
  listarTorneos,
  obtenerTorneo,
  editarTorneo,
  eliminarTorneo,
  iniciarTorneo,
  pingTorneo,
  añadirParticipantes,
  eliminarParticipante,
  listarPartidasDeTorneo,
  obtenerMensajesChat,
  enviarMensajeChat,
} from '../controllers/torneos.controller';

const router = Router();

// Listado
router.get    ('/clase/:claseId',                          verificarAutenticacion, listarTorneos);

// CRUD torneo
router.post   ('/',                                        verificarAutenticacion, crearTorneo);
router.get    ('/:torneoId',                               verificarAutenticacion, obtenerTorneo);
router.patch  ('/:torneoId',                               verificarAutenticacion, editarTorneo);
router.delete ('/:torneoId',                               verificarAutenticacion, eliminarTorneo);

// Acciones
router.post   ('/:torneoId/iniciar',                       verificarAutenticacion, iniciarTorneo);
router.post   ('/:torneoId/ping',                          verificarAutenticacion, pingTorneo);

// Participantes
router.post   ('/:torneoId/participantes',                 verificarAutenticacion, añadirParticipantes);
router.delete ('/:torneoId/participantes/:usuarioId',      verificarAutenticacion, eliminarParticipante);

// Partidas del torneo
router.get    ('/:torneoId/partidas',                      verificarAutenticacion, listarPartidasDeTorneo);

// Chat
router.get    ('/:torneoId/chat',                          verificarAutenticacion, obtenerMensajesChat);
router.post   ('/:torneoId/chat',                          verificarAutenticacion, enviarMensajeChat);

export default router;