import { Request, Response } from 'express';
import { AuthService, RegistroUsuarioDTO } from '../services/auth.service';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, nombre, apellidos, rol } = req.body as RegistroUsuarioDTO;

      // Validaciones básicas de entrada
      if (!email || !password || !nombre || !apellidos || !rol) {
        res.status(400).json({ 
          success: false, 
          message: 'Faltan campos obligatorios (email, password, nombre, apellidos, rol)' 
        });
        return;
      }

      if (rol !== 'profesor' && rol !== 'alumno') {
        res.status(400).json({ 
          success: false, 
          message: 'El rol debe ser profesor o alumno' 
        });
        return;
      }

      // Llamada al servicio
      const nuevoUsuario = await AuthService.registrarUsuario({ email, password, nombre, apellidos, rol });

      res.status(201).json({
        success: true,
        message: 'Usuario registrado correctamente',
        data: nuevoUsuario
      });

    } catch (error: any) {
      console.error('Error en AuthController.register:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }
}