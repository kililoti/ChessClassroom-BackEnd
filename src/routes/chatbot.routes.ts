import { Router } from 'express';
import { chatIA } from '../controllers/chatbot.controller';
import { verificarAutenticacion } from '../middlewares/auth.middleware';

const router = Router();
router.post('/', verificarAutenticacion, chatIA);
export default router;