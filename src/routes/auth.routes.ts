import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = Router();

// Endpoint: POST /api/auth/registro
router.post('/registro', AuthController.register);

// Endpoint: POST /api/auth/login
router.post('/login', AuthController.login);
export default router;