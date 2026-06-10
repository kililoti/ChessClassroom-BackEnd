import { createClient } from '@supabase/supabase-js';
import { ChatService } from './chat.service';

// Usar la service_role_key para operar como administradores desde el backend
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export class ClaseService {
  
  // Crear una clase y asignar automáticamente al creador como profesor
  static async crearClase(profesorId: string, nombre: string, descripcion: string, tipo: 'grupal' | 'particular') {
    
    // Verificación de rol
    const { data: usuario, error: errorUsuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', profesorId)
      .single();

    if (errorUsuario || !usuario) {
      throw new Error('Usuario no encontrado en el sistema');
    }

    if (usuario.rol !== 'profesor') {
      throw new Error('Acceso denegado: Solo los profesores tienen permisos para crear clases.');
    }

    // Insertar la clase (el código de invitación se genera automáticamente en BD)
    const { data: clase, error: errorClase } = await supabase
      .from('clases')
      .insert([{ nombre, descripcion, tipo }])
      .select()
      .single();

    if (errorClase) throw new Error(`Error al crear clase: ${errorClase.message}`);

    // Asignar el profesor a la tabla intermedia
    const { error: errorProfesor } = await supabase
      .from('clase_profesores')
      .insert([{ clase_id: clase.id, profesor_id: profesorId }]);

    if (errorProfesor) throw new Error(`Error al asignar profesor: ${errorProfesor.message}`);

    // Creación automática de salas de chat para la clase y asignación del profesor a esas salas
    // Crear las salas por defecto
    const { data: salas, error: errorSalas } = await supabase
      .from('salas_chat')
      .insert([
        { clase_id: clase.id, nombre: 'General', tipo: 'clase_general' },
        { clase_id: clase.id, nombre: 'Material de estudio', tipo: 'clase_estudio' }
      ])
      .select('id'); // Pedir que devuelva los IDs generados

    if (errorSalas) {
      console.error('Advertencia: La clase se creó, pero fallaron los chats:', errorSalas);
    } 
    // Meter al profesor automáticamente como participante de esas salas
    else if (salas && salas.length > 0) {
      const participantesData = salas.map(sala => ({
        sala_id: sala.id,
        usuario_id: profesorId
      }));

      const { error: errorParticipantes } = await supabase
        .from('participantes_chat')
        .insert(participantesData); // Inserción múltiple (Bulk insert)

      if (errorParticipantes) {
        console.error('Advertencia: No se pudo añadir al profesor a los chats:', errorParticipantes);
      }
    }

    return clase;
  }

  // Obtener info pública de una clase por su código (Para el Link de Invitación)
  static async obtenerInfoInvitacion(codigo: string) {
    const { data, error } = await supabase
      .from('clases')
      .select('id, nombre, tipo, activo')
      .eq('codigo_invitacion', codigo)
      .single();

    if (error || !data) throw new Error('Código de invitación inválido o clase inexistente');
    if (!data.activo) throw new Error('Esta clase ya no está activa');

    return data;
  }

  // Lógica para que un alumno se una usando un código
  static async unirseConCodigo(alumnoId: string, codigo: string) {
    // Validar la clase
    const clase = await this.obtenerInfoInvitacion(codigo);

    // Verificar si el alumno ya está dentro
    const { data: existente } = await supabase
      .from('clase_alumnos')
      .select('*')
      .eq('clase_id', clase.id)
      .eq('alumno_id', alumnoId)
      .single();

    if (existente) throw new Error('Ya estás inscrito en esta clase');

    // Intentar insertar
    const { error: errorInsert } = await supabase
      .from('clase_alumnos')
      .insert([{ clase_id: clase.id, alumno_id: alumnoId }]);

    if (errorInsert) {
      if (errorInsert.message.includes('Integridad de datos')) {
        throw new Error('Esta clase particular ya está asignada a otro alumno');
      }
      throw new Error('Error al unirse a la clase');
    }

    // Obtener todas las salas de chat que pertenezcan a esta clase
    const { data: salas } = await supabase
      .from('salas_chat')
      .select('id')
      .eq('clase_id', clase.id);

    // Si hay salas, meter al alumno en todas ellas de golpe
    if (salas && salas.length > 0) {
      const participantesData = salas.map(sala => ({
        sala_id: sala.id,
        usuario_id: alumnoId
      }));

      const { error: errorParticipantes } = await supabase
        .from('participantes_chat')
        .insert(participantesData);

      if (errorParticipantes) {
        // Hacer un console.error en lugar de un throw para que no se cancele 
        // la respuesta exitosa de inscripción a la clase, pero quede registrado el bug.
        console.error('Error al inscribir al alumno en los chats:', errorParticipantes);
      }
    }
    // ------------------------------------------

    return { mensaje: 'Te has unido a la clase correctamente', claseId: clase.id };
  }

  // Cambiar estado activo/inactivo
  static async cambiarEstado(claseId: string, estado: boolean) {
    const { data, error } = await supabase
      .from('clases')
      .update({ activo: estado })
      .eq('id', claseId)
      .select()
      .single();

    if (error) throw new Error('Error al actualizar el estado de la clase');
    return data;
  }

  // Eliminar la clase de forma permanente (Hard Delete)
  static async eliminarClase(claseId: string) {
    const { data, error } = await supabase
      .from('clases')
      .delete()
      .eq('id', claseId)
      .select()
      .single();

    if (error) throw new Error(`Error al eliminar la clase: ${error.message}`);
    return data;
  }

  // Obtener todas las clases (grupales y particulares) de un profesor
  static async getClasesPorProfesor(profesorId: string) {
    const { data, error } = await supabase
      .from('clases')
      .select('*, clase_profesores!inner(profesor_id)')
      .eq('clase_profesores.profesor_id', profesorId);

    if (error) throw new Error(`Error al obtener clases: ${error.message}`);
    return data;
  }

  // Obtener todas las clases (grupales y particulares) de un alumno
  static async getClasesPorAlumno(alumnoId: string) {
    const { data, error } = await supabase
      .from('clases')
      .select('*, clase_alumnos!inner(alumno_id)')
      .eq('clase_alumnos.alumno_id', alumnoId);

    if (error) throw new Error(`Error al obtener clases del alumno: ${error.message}`);
    return data;
  }

  // Obtener una clase específica y su sala de chat principal
  static async obtenerClasePorId(claseId: string) {
    // Buscar los datos de la clase
    const { data: clase, error: errorClase } = await supabase
      .from('clases')
      .select('*')
      .eq('id', claseId)
      .single();

    if (errorClase || !clase) throw new Error('Clase no encontrada');

    // Pedir al ChatService que busque la sala de chat general
    const salaId = await ChatService.obtenerIdSalaGeneral(claseId);

    // Devolver el paquete completo al controlador
    return {
      ...clase,
      salaIdPrincipal: salaId
    };
  }

  // Obtener todos los alumnos de una clase con sus datos de usuario
static async getAlumnosPorClase(claseId: string) {
  const { data, error } = await supabase
    .from('clase_alumnos')
    .select(`
      alumno_id,
      fecha_inscripcion,
      usuarios!inner(
        id,
        nombre,
        apellidos,
        correo,
        foto
      )
    `)
    .eq('clase_id', claseId);

  if (error) throw new Error(`Error al obtener alumnos: ${error.message}`);

  // Aplanar el resultado para devolver un array limpio de alumnos
  return data.map((item: any) => ({
    id: item.usuarios.id,
    nombre: item.usuarios.nombre,
    apellidos: item.usuarios.apellidos,
    correo: item.usuarios.correo,
    foto: item.usuarios.foto,
    fecha_inscripcion: item.fecha_inscripcion,
  }));
}
}