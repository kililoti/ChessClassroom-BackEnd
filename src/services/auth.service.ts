import { supabaseAdmin } from '../config/supabase';
import { RegistroUsuarioDTO, LoginUsuarioDTO } from '../types/index';

export class AuthService {
  static async registrarUsuario(datos: RegistroUsuarioDTO) {
    // Crear el usuario en auth.users (Autenticación de Supabase)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: datos.email,
      password: datos.password,
      email_confirm: true // Asumir el email como confirmado para no crear correos de verificación y acelerar el proceso de desarrollo.
    });

    if (authError) {
      throw new Error(`Error en autenticación: ${authError.message}`);
    }

    const userId = authData.user.id;

    // Insertar los datos adicionales en la tabla pública 'usuarios'
    const { data: usuarioData, error: dbError } = await supabaseAdmin
      .from('usuarios')
      .insert([
        {
          id: userId, // Mismo ID de auth.users (Clave compartida)
          correo: datos.email,
          nombre: datos.nombre,
          apellidos: datos.apellidos,
          rol: datos.rol
        }
      ])
      .select()
      .single();

    // Rollback
    if (dbError) {
      // Si la inserción en la base de datos falla, borrar el usuario de auth
      // para evitar dejar un usuario fantasma que no puede iniciar sesión correctamente.
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Error al crear el perfil: ${dbError.message}`);
    }

    return usuarioData;
  }

  static async loginUsuario(datos: LoginUsuarioDTO) {
    // Verificar las credenciales con Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: datos.email,
      password: datos.password as string,
    });

    // Si la contraseña está mal o el usuario no existe, Supabase devuelve un error
    if (authError) {
      throw new Error(`Credenciales incorrectas: ${authError.message}`);
    }

    const userId = authData.user.id;

    // Obtener el perfil completo de la tabla pública
    const { data: perfilData, error: perfilError } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single();

    if (perfilError) {
      throw new Error(`Error al obtener los datos del perfil: ${perfilError.message}`);
    }

    // Devolver la sesión (el token JWT) y el perfil fusionados
    return {
      token: authData.session.access_token,
      usuario: perfilData
    };
  }
}