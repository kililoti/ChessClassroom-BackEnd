import { supabaseAdmin } from '../config/supabase';

export interface RegistroUsuarioDTO {
  email: string;
  password?: string; // Opcional si se usa OAuth en el futuro
  nombre: string;
  rol: 'profesor' | 'alumno';
}

export class AuthService {
  static async registrarUsuario(datos: RegistroUsuarioDTO) {
    // 1. Crear el usuario en auth.users (Autenticación de Supabase)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: datos.email,
      password: datos.password,
      email_confirm: true // Asumimos el email como confirmado para no crear correos de verificación y acelerar el proceso de desarrollo.
    });

    if (authError) {
      throw new Error(`Error en autenticación: ${authError.message}`);
    }

    const userId = authData.user.id;

    // 2. Insertar los datos adicionales en la tabla pública 'usuarios'
    const { data: usuarioData, error: dbError } = await supabaseAdmin
      .from('usuarios')
      .insert([
        {
          id: userId, // Mismo ID de auth.users (Clave compartida)
          correo: datos.email,
          nombre: datos.nombre,
          rol: datos.rol
        }
      ])
      .select()
      .single();

    // 3. Rollback
    if (dbError) {
      // Si la inserción en la base de datos falla, borramos el usuario de auth
      // para evitar dejar un usuario fantasma que no puede iniciar sesión correctamente.
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Error al crear el perfil: ${dbError.message}`);
    }

    return usuarioData;
  }
}