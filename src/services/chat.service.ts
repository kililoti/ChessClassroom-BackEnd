import { supabaseAdmin } from '../config/supabase';

export class ChatService {
  
  // Obtener todas las salas en las que participa el usuario
  static async obtenerMisSalas(usuarioId: string) {
    const { data, error } = await supabaseAdmin
      .from('participantes_chat')
      .select(`
        sala_id,
        unido_en,
        salas_chat (
          id,
          nombre,
          tipo,
          clase_id,
          partida_id,
          creado_en
        )
      `)
      .eq('usuario_id', usuarioId);

    if (error) throw new Error(`Error al obtener tus salas: ${error.message}`);
    
    // Aplanar el resultado para que el frontend reciba un array limpio de salas
    return data.map((participacion: any) => participacion.salas_chat);
  }

  // Obtener el historial de mensajes de una sala concreta
  static async obtenerMensajes(salaId: string, usuarioId: string) {
    // Verificar si el el usuario está en esta sala
    await this.verificarParticipacion(salaId, usuarioId);

    const { data, error } = await supabaseAdmin
      .from('mensajes')
      .select(`
        id,
        contenido,
        leido,
        creado_en,
        remitente_id,
        usuarios (nombre, apellidos)
      `)
      .eq('sala_id', salaId)
      .order('creado_en', { ascending: true }); // Orden cronológico (los más antiguos primero)

    if (error) throw new Error(`Error al cargar el historial: ${error.message}`);
    return data;
  }

  // Enviar un nuevo mensaje
  static async enviarMensaje(salaId: string, remitenteId: string, contenido: string) {
    await this.verificarParticipacion(salaId, remitenteId);

    const { data, error } = await supabaseAdmin
      .from('mensajes')
      .insert([{ 
        sala_id: salaId, 
        remitente_id: remitenteId, 
        contenido 
      }])
      .select()
      .single();

    if (error) throw new Error(`Error al enviar el mensaje: ${error.message}`);
    return data;
  }

  // Comprobar si el usuario es participante de la sala
  private static async verificarParticipacion(salaId: string, usuarioId: string) {
    const { data, error } = await supabaseAdmin
      .from('participantes_chat')
      .select('id')
      .eq('sala_id', salaId)
      .eq('usuario_id', usuarioId)
      .single();

    if (error || !data) {
      throw new Error('Acceso denegado: No perteneces a esta sala de chat');
    }
    return true;
  }

  // Obtener el id del chat general según el id de la clase
  static async obtenerIdSalaGeneral(claseId: string) {
    const { data, error } = await supabaseAdmin
      .from('salas_chat')
      .select('id')
      .eq('clase_id', claseId)
      .eq('tipo', 'clase_general')
      .single();

    // Si hay error o no existe, devolver null en lugar de romper la app
    if (error || !data) return null; 
    
    return data.id;
  }
}