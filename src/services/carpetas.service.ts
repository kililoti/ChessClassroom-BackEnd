import { supabaseAdmin } from '../config/supabase';

export const crearCarpeta = async (
  nombre: string,
  modulo: string,
  profesorId: string,
  claseId: string,
  carpetaPadreId?: string,
  visible: boolean = true
) => {
  // Crear la carpeta
  const { data: carpeta, error } = await supabaseAdmin
    .from('recursos_carpetas')
    .insert({
      nombre,
      modulo,
      profesor_id: profesorId,
      clase_id: claseId || null,
      carpeta_padre_id: carpetaPadreId || null,
      visible
    })
    .select()
    .single();

  if (error) throw new Error(`Error al crear la carpeta: ${error.message}`);

  // Crear sala de chat asociada a la carpeta automáticamente
  const { data: sala, error: errorSala } = await supabaseAdmin
    .from('salas_chat')
    .insert({
      clase_id: claseId,
      nombre: `Chat · ${nombre}`,
      tipo: 'carpeta_recursos',
      carpeta_id: carpeta.id, 
    })
    .select('id')
    .single();

  if (errorSala) {
    console.error('Advertencia: La carpeta se creó pero falló la sala de chat:', errorSala);
  } else if (sala) {
    // Añadir automáticamente a todos los participantes de la clase a la sala de chat
    const [{ data: profesores }, { data: alumnos }] = await Promise.all([
      supabaseAdmin.from('clase_profesores').select('profesor_id').eq('clase_id', claseId),
      supabaseAdmin.from('clase_alumnos').select('alumno_id').eq('clase_id', claseId),
    ]);

    const participantes = [
      ...(profesores ?? []).map((p: any) => ({ sala_id: sala.id, usuario_id: p.profesor_id })),
      ...(alumnos   ?? []).map((a: any) => ({ sala_id: sala.id, usuario_id: a.alumno_id   })),
    ];

    if (participantes.length > 0) {
      const { error: errorPart } = await supabaseAdmin
        .from('participantes_chat')
        .insert(participantes);

      if (errorPart) {
        console.error('Advertencia: No se pudieron añadir participantes al chat de la carpeta:', errorPart);
      }
    }
  }

  return carpeta;
};

export const obtenerCarpetas = async (
  claseId: string,
  modulo: string,
  carpetaPadreId: string | null | undefined,
  esProfesor: boolean
) => {
  let query = supabaseAdmin
    .from('recursos_carpetas')
    .select(`*, usuarios (nombre, apellidos)`)
    .eq('clase_id', claseId)
    .eq('modulo', modulo);

  if (carpetaPadreId) {
    query = query.eq('carpeta_padre_id', carpetaPadreId);
  } else {
    query = query.is('carpeta_padre_id', null);
  }

  if (!esProfesor) query = query.eq('visible', true);
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
};

export const obtenerCarpetaPorId = async (id: string) => {
  const { data, error } = await supabaseAdmin
    .from('recursos_carpetas')
    .select(`*, usuarios (nombre, apellidos)`)
    .eq('id', id)
    .single();

  if (error) throw new Error(`Carpeta no encontrada: ${error.message}`);
  return data;
};

export const obtenerAncestrosCarpeta = async (carpetaId: string): Promise<{ id: string; nombre: string }[]> => {
  const ancestros: { id: string; nombre: string }[] = [];
  let idActual: string | null = carpetaId;

  for (let i = 0; i < 10; i++) {
    if (!idActual) break;

    const { data, error } = await supabaseAdmin
      .from('recursos_carpetas')
      .select('id, nombre, carpeta_padre_id')
      .eq('id', idActual)
      .single() as { data: { id: string; nombre: string; carpeta_padre_id: string | null } | null; error: any };

    if (error || !data) break;
    ancestros.unshift({ id: data.id, nombre: data.nombre });
    idActual = data.carpeta_padre_id;
  }

  return ancestros;
};

export const obtenerSalaCarpeta = async (carpetaId: string): Promise<string | null> => {
  const { data, error } = await supabaseAdmin
    .from('salas_chat')
    .select('id')
    .eq('carpeta_id', carpetaId)
    .single();

  if (error || !data) return null;
  return data.id;
};

export const eliminarCarpeta = async (carpetaId: string) => {
  const { error } = await supabaseAdmin
    .from('recursos_carpetas')
    .delete()
    .eq('id', carpetaId);

  if (error) throw new Error(`Error al eliminar la carpeta: ${error.message}`);
  return true;
};

export const actualizarVisibilidadCarpeta = async (id: string, visible: boolean) => {
  const { data, error } = await supabaseAdmin
    .from('recursos_carpetas')
    .update({ visible })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Error al actualizar carpeta: ${error.message}`);
  return data;
};