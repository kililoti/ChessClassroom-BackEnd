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

    const token = authHeader.split(' ')[1];

    // Pedir a Supabase que valide este token
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData.user) {
      res.status(401).json({ 
        success: false, 
        message: 'Acceso denegado: Token inválido o expirado.' 
      });
      return;
    }

    // Buscar el rol en tabla 'usuarios'
    const { data: userData, error: dbError } = await supabaseAdmin
      .from('usuarios')
      .select('rol, nombre, apellidos')
      .eq('id', authData.user.id)
      .maybeSingle(); // Usar maybeSingle() en lugar de single() para que no lance error si no lo encuentra

    if (dbError) {
      console.error(`Error al buscar usuario en DB (ID: ${authData.user.id}):`, dbError.message);
      // No bloquea la petición, deja que continúe como "alumno" por seguridad
    }

    // Inyectar sus datos combinados en la Request
    (req as any).usuario = {
      ...authData.user, // Mantiene todo lo que ya tenía (id, email, etc.)
      rol: userData?.rol || 'alumno', // Fallback a "alumno" si no encuentra el usuario o el rol
      nombre: userData?.nombre || 'Usuario',
      apellidos: userData?.apellidos || 'Desconocido'
    };

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