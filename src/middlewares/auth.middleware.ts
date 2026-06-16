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
 
// Verifica que el usuario autenticado tiene rol de profesor
export const verificarProfesor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const usuario = (req as any).usuario;

    if (!usuario) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado.' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('rol')
      .eq('id', usuario.id)
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
      return;
    }

    if (data.rol !== 'profesor') {
      res.status(403).json({ success: false, message: 'Acceso restringido a profesores.' });
      return;
    }

    // Inyectamos el rol para usarlo después si hace falta
    (req as any).usuario.rol = data.rol;
    next();

  } catch (error) {
    console.error('Error en verificarProfesor:', error);
    res.status(500).json({ success: false, message: 'Error al verificar el rol.' });
  }
};

// Verifica que el profesor autenticado pertenece a la clase indicada
export const verificarProfesorDeClase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const usuario = (req as any).usuario;
    const claseId = req.body.clase_id || req.params.claseId;

    if (!claseId) {
      res.status(400).json({ success: false, message: 'clase_id no proporcionado.' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('clase_profesores')
      .select('clase_id')
      .eq('clase_id', claseId)
      .eq('profesor_id', usuario.id)
      .single();

    if (error || !data) {
      res.status(403).json({ success: false, message: 'No eres profesor de esta clase.' });
      return;
    }

    next();

  } catch (error) {
    console.error('Error en verificarProfesorDeClase:', error);
    res.status(500).json({ success: false, message: 'Error al verificar la clase.' });
  }
};

export const verificarProfesorDeAula = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const usuario = (req as any).usuario;
    const { aulaId } = req.params as { aulaId: string };

    if (!aulaId) {
      res.status(400).json({ success: false, message: 'aulaId no proporcionado.' });
      return;
    }

    // Buscar el aula para obtener clase_id
    const { data: aula, error } = await supabaseAdmin
      .from('aulas_virtuales')
      .select('clase_id')
      .eq('id', aulaId)
      .single();

    if (error || !aula) {
      res.status(404).json({ success: false, message: 'Aula no encontrada.' });
      return;
    }

    // Verificar que es profesor de esa clase
    const { data, error: errorProfesor } = await supabaseAdmin
      .from('clase_profesores')
      .select('clase_id')
      .eq('clase_id', aula.clase_id)
      .eq('profesor_id', usuario.id)
      .single();

    if (errorProfesor || !data) {
      res.status(403).json({ success: false, message: 'No eres profesor de esta clase.' });
      return;
    }

    next();

  } catch (error) {
    console.error('Error en verificarProfesorDeAula:', error);
    res.status(500).json({ success: false, message: 'Error al verificar el aula.' });
  }
};