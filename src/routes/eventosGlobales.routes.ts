import { Router } from 'express';
import { getEventosGlobales } from '../controllers/eventosGlobales.controller';
import { verificarAutenticacion } from '../middlewares/auth.middleware';

const router = Router();
router.get('/', verificarAutenticacion, getEventosGlobales);
export default router;