import { Router } from 'express';
import { verificarAutenticacion } from '../middlewares/auth.middleware';
import {
  crearPartida,
  listarPartidas,
  obtenerPartida,
  unirseAPartida,
  iniciarPartida,
  realizarMovimiento,
  gestionarTablas,
  abandonarPartida,
  eliminarPartida,
  guardarEnEstudio,
  obtenerMensajesChat,
  enviarMensajeChat,
} from '../controllers/partidas.controller';

const router = Router();

// Listado e historial
router.get    ('/clase/:claseId',              verificarAutenticacion, listarPartidas);

// CRUD partida — rutas específicas antes que /:partidaId
router.post   ('/',                            verificarAutenticacion, crearPartida);
router.get    ('/:partidaId',                  verificarAutenticacion, obtenerPartida);
router.delete ('/:partidaId',                  verificarAutenticacion, eliminarPartida);

// Acciones de partida
router.post   ('/:partidaId/unirse',           verificarAutenticacion, unirseAPartida);
router.post   ('/:partidaId/iniciar',          verificarAutenticacion, iniciarPartida);
router.post   ('/:partidaId/movimiento',       verificarAutenticacion, realizarMovimiento);
router.post   ('/:partidaId/tablas',           verificarAutenticacion, gestionarTablas);
router.post   ('/:partidaId/abandonar',        verificarAutenticacion, abandonarPartida);
router.post   ('/:partidaId/guardar-estudio',  verificarAutenticacion, guardarEnEstudio);

// Chat
router.get    ('/:partidaId/chat',             verificarAutenticacion, obtenerMensajesChat);
router.post   ('/:partidaId/chat',             verificarAutenticacion, enviarMensajeChat);

export default router;