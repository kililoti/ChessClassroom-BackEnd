import { Router } from 'express';
import { verificarAutenticacion } from '../middlewares/auth.middleware';
import {
  crearInvitacion,
  responderInvitacion,
  listarInvitacionesPendientes,
} from '../controllers/invitaciones.controller';

const router = Router();

router.get  ('/pendientes',      verificarAutenticacion, listarInvitacionesPendientes);
router.post ('/',                verificarAutenticacion, crearInvitacion);
router.patch('/:id/responder',   verificarAutenticacion, responderInvitacion);

export default router;