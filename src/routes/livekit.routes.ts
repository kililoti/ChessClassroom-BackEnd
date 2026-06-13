import { Router } from 'express';
import { verificarAutenticacion, verificarProfesorDeAula } from '../middlewares/auth.middleware';
import { obtenerTokenLiveKit, mutearAlumno, expulsarAlumno } from '../controllers/livekit.controller';

const router = Router();

router.use(verificarAutenticacion);

router.get('/token/:aulaId',                              obtenerTokenLiveKit);
router.patch('/:aulaId/mutear/:participanteId',   verificarProfesorDeAula, mutearAlumno);
router.delete('/:aulaId/expulsar/:participanteId', verificarProfesorDeAula, expulsarAlumno);

export default router;