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
  // 1. Filtros básicos e INNER JOIN
  let query = supabaseAdmin
    .from('recursos_carpetas')
    .select(`
      *,
      usuarios (nombre, apellidos)
    `)
    .eq('clase_id', claseId)
    .eq('modulo', modulo);

  // 2. Filtro Jerárquico (Navegación entre carpetas)
  if (carpetaPadreId) {
    query = query.eq('carpeta_padre_id', carpetaPadreId);
  } else {
    query = query.is('carpeta_padre_id', null); // Si no hay padre, trae la raíz
  }

  // 3. Filtro de Seguridad (Visibilidad)
  if (!esProfesor) {
    query = query.eq('visible', true);
  }

  // 4. Opcional: Ordenar alfabéticamente o por fecha
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("Error SQL:", error);
    throw new Error(error.message);
  }

  return data;
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