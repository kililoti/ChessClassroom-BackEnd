import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = Router();

// Endpoint: POST /api/auth/registro
router.post('/registro', AuthController.register);

export default router;