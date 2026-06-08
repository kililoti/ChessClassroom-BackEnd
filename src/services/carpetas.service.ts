import { supabaseAdmin } from '../config/supabase';

export const crearCarpeta = async (
  nombre: string,
  modulo: string,
  profesorId: string,
  claseId: string,
  carpetaPadreId?: string,
  visible: boolean = true
) => {
  const { data, error } = await supabaseAdmin
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
  return data;
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

  if (!esProfesor) {
    query = query.eq('visible', true);
  }

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

// Recibe el ID de una carpeta y devuelve el array de breadcrumbs ordenado desde
// la raíz hasta esa carpeta: [{ id, nombre }, { id, nombre }, ...]
// Se usa cuando el usuario accede directamente a una URL anidada para reconstruir
// el breadcrumb completo sin necesidad de haber navegado paso a paso.
export const obtenerAncestrosCarpeta = async (carpetaId: string): Promise<{ id: string; nombre: string }[]> => {
  const ancestros: { id: string; nombre: string }[] = [];
  let idActual: string | null = carpetaId;

  // Subir nivel a nivel hasta llegar a la raíz (carpeta_padre_id === null)
  // Máximo 10 niveles para evitar bucles infinitos por datos corruptos
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