import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const verificarAutenticacion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Buscar el token en las cabeceras de la petición
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        success: false, 
        message: 'Acceso denegado: No se proporcionó un token de autenticación.' 
      });
      return;
    }

    // Extraer solo el JWT (quitar la palabra "Bearer ")
    const token = authHeader.split(' ')[1];

    // Pedir a Supabase que valide este token
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ 
        success: false, 
        message: 'Acceso denegado: Token inválido o expirado.' 
      });
      return;
    }

    // Si es real, inyectar sus datos en la Request
    (req as any).usuario = data.user;

    // Decir a Express que continúe hacia el Controlador
    next();
    
  } catch (error) {
    console.error('Error en el middleware de autenticación:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno al verificar la autenticación.' 
    });
  }
};