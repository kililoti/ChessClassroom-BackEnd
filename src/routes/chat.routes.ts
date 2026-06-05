import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
// Asegúrate de importar tu middleware de autenticación (el que verifica el JWT)
import { verificarAutenticacion } from '../middlewares/auth.middleware'; 

const router = Router();

// Todas las rutas de chat requieren que el usuario haya iniciado sesión
router.use(verificarAutenticacion);

// GET /api/chats - Lista de salas del usuario
router.get('/', ChatController.getMisSalas);

// GET /api/chats/:salaId/mensajes - Historial de una sala específica
router.get('/:salaId/mensajes', ChatController.getMensajes);

// POST /api/chats/:salaId/mensajes - Enviar un mensaje por REST API
router.post('/:salaId/mensajes', ChatController.postMensaje);

export default router;