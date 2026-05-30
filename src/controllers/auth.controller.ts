import { Request, Response } from 'express';
import { AuthService, RegistroUsuarioDTO, LoginUsuarioDTO } from '../services/auth.service';

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

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body as LoginUsuarioDTO;

      // 1. Validación básica
      if (!email || !password) {
        res.status(400).json({ 
          success: false, 
          message: 'Faltan campos obligatorios (email y password)' 
        });
        return;
      }

      // 2. Llamada al servicio
      const datosLogin = await AuthService.loginUsuario({ email, password });

      // 3. Respuesta exitosa (Código 200 OK)
      res.status(200).json({
        success: true,
        message: 'Inicio de sesión exitoso',
        data: datosLogin // Incluye el token y el perfil
      });

    } catch (error: any) {
      console.error('Error en AuthController.login:', error);
      // Código 401 (Unauthorized) cuando fallan las credenciales
      res.status(401).json({
        success: false,
        message: error.message || 'Error al iniciar sesión'
      });
    }
  }
}