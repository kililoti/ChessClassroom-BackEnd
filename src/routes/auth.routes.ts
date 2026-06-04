import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = Router();

// Registrar usuario Endpoint: POST /api/auth/registro
router.post('/registro', AuthController.register);

// Iniciar sesión Endpoint: POST /api/auth/login
router.post('/login', AuthController.login);
export default router;