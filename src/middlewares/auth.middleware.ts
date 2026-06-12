import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
 
export const verificarAutenticacion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        success: false, 
        message: 'Acceso denegado: No se proporcionó un token de autenticación.' 
      });
      return;
    }
 
    const token = authHeader.split(' ')[1];
 
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
 
    if (authError || !authData.user) {
      res.status(401).json({ 
        success: false, 
        message: 'Acceso denegado: Token inválido o expirado.' 
      });
      return;
    }
 
    const { data: userData, error: dbError } = await supabaseAdmin
      .from('usuarios')
      .select('rol, nombre, apellidos')
      .eq('id', authData.user.id)
      .maybeSingle();
 
    if (dbError) {
      console.error(`Error al buscar usuario en DB (ID: ${authData.user.id}):`, dbError.message);
    }
 
    (req as any).usuario = {
      ...authData.user,
      rol: userData?.rol || 'alumno',
      nombre: userData?.nombre || 'Usuario',
      apellidos: userData?.apellidos || 'Desconocido'
    };
 
    next();
    
  } catch (error) {
    console.error('Error en el middleware de autenticación:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno al verificar la autenticación.' 
    });
  }
};
 
// ── Nuevos middlewares ────────────────────────────────────
 
export const verificarProfesor = (req: Request, res: Response, next: NextFunction): void => {
  const usuario = (req as any).usuario;
  if (usuario?.rol !== 'profesor') {
    res.status(403).json({ success: false, message: 'Acceso denegado: se requiere rol de profesor.' });
    return;
  }
  next();
};
 
export const verificarProfesorDeClase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const usuario = (req as any).usuario;
    const claseId = req.params.claseId ?? req.body?.clase_id;
 
    if (!claseId) { next(); return; }
 
    const { data, error } = await supabaseAdmin
      .from('clase_profesores')
      .select('clase_id')
      .eq('clase_id', claseId)
      .eq('profesor_id', usuario.id)
      .maybeSingle();
 
    if (error || !data) {
      res.status(403).json({ success: false, message: 'Acceso denegado: no eres profesor de esta clase.' });
      return;
    }
 
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al verificar permisos de clase.' });
  }
};