import { Router } from 'express';
import { verificarAutenticacion } from '../middlewares/auth.middleware';
import * as datosController from '../controllers/datos.controller';

const router = Router();

router.get('/ejercicios/:alumnoId', verificarAutenticacion, datosController.getRendimientoEjercicios);
router.get('/partidas/:alumnoId', verificarAutenticacion, datosController.getRendimientoPartidas);
router.get('/alumnos/:claseId', verificarAutenticacion, datosController.getAlumnosDeClase);

export default router;