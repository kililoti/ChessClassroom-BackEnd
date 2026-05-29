import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = Router();

// Endpoint: POST /api/auth/register
router.post('/register', AuthController.register);

export default router;