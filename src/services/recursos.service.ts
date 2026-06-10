import { supabaseAdmin } from '../config/supabase';
import { Chess } from 'chess.js';

interface PartidaMetadata {
  index: number;
  blancas: string;
  negras: string;
  resultado: string;
  fecha: string;
  evento: string;
}

export const procesarYSubirPGN = async (
  archivoBuffer: Buffer,
  nombreOriginal: string,
  mimeType: string,
  carpetaId: string,
  profesorId: string,
  categoria: string,
  nombrePersonalizado?: string,
  visible: boolean = true,
  tipoRecurso: 'estudio' | 'ejercicio' = 'estudio'
) => {
  const rawText = archivoBuffer.toString('utf-8');
  const bloquesJuego = rawText.split(/(?=\[Event\s)/g).filter(block => block.trim().length > 0);
  const partidasMetadata: PartidaMetadata[] = [];

  bloquesJuego.forEach((bloque, index) => {
    const chess = new Chess();
    try {
      chess.loadPgn(bloque);
      const headers = chess.header();
      partidasMetadata.push({
        index,
        blancas: headers['White'] || 'Anónimo',
        negras: headers['Black'] || 'Anónimo',
        resultado: headers['Result'] || '*',
        fecha: headers['Date'] || '????.??.??',
        evento: headers['Event'] || 'Casual'
      });
    } catch (error) {
      console.warn(`Error parseando partida en índice ${index}.`);
    }
  });

  const metadata = {
    es_base_datos: bloquesJuego.length > 1,
    total_partidas: bloquesJuego.length,
    partidas: partidasMetadata
  };

  const timestamp = Date.now();
  const storagePath = `recursos/${profesorId}/${timestamp}_${nombreOriginal}`;

  const { error: storageError } = await supabaseAdmin.storage
    .from('recursos_educativos')
    .upload(storagePath, archivoBuffer, { contentType: mimeType, upsert: false });

  if (storageError) throw new Error(`Error en Storage: ${storageError.message}`);

  const { data: registroBD, error: dbError } = await supabaseAdmin
    .from('recursos_archivos')
    .insert({
      nombre: nombrePersonalizado || nombreOriginal,
      carpeta_id: carpetaId,
      profesor_id: profesorId,
      categoria,
      storage_path: storagePath,
      metadata,
      visible,
      tipo_recurso: tipoRecurso,
    })
    .select()
    .single();

  if (dbError) {
    await supabaseAdmin.storage.from('recursos_educativos').remove([storagePath]);
    throw new Error(`Error en Base de Datos: ${dbError.message}`);
  }

  return registroBD;
};

export const generarUrlDescarga = async (archivoId: string) => {
  const { data: archivo, error: dbError } = await supabaseAdmin
    .from('recursos_archivos')
    .select('storage_path, visible')
    .eq('id', archivoId)
    .single();

  if (dbError || !archivo) throw new Error('Archivo no encontrado.');
  if (!archivo.storage_path) throw new Error('Este recurso no tiene un archivo físico asociado.');

  const { data: urlData, error: urlError } = await supabaseAdmin.storage
    .from('recursos_educativos')
    .createSignedUrl(archivo.storage_path, 60);

  if (urlError) throw new Error(`Error al generar enlace: ${urlError.message}`);

  return urlData.signedUrl;
};

export const obtenerArchivosDeCarpeta = async (
  carpetaId: string,
  esProfesor: boolean,
  usuarioId?: string
) => {
  let query = supabaseAdmin
    .from('recursos_archivos')
    .select(`
      *, 
      usuarios (nombre, apellidos),
      ejercicios (
        id,
        fecha_inicio,
        fecha_entrega,
        solucion_pgn,
        respuestas_alumnos (
          alumno_id,
          estado,
          puntuacion
        )
      )
    `)
    .eq('carpeta_id', carpetaId)
    .order('created_at', { ascending: false });
 
  if (!esProfesor) {
    query = query.eq('visible', true);
  }
 
  const { data, error } = await query;
  if (error) throw new Error(error.message);
 
  const ahora = new Date();
 
  const archivosMapeados = data.map((archivo: any) => {
    const ejConfig = Array.isArray(archivo.ejercicios) ? archivo.ejercicios[0] : archivo.ejercicios;
 
    if (!esProfesor && ejConfig) {
      if (!ejConfig.solucion_pgn || !ejConfig.fecha_inicio || !ejConfig.fecha_entrega) {
        return null;
      }
    }
 
    let estado_alumno     = undefined;
    let puntuacion_alumno = undefined;
 
    if (ejConfig && !esProfesor && usuarioId) {
      const resp = ejConfig.respuestas_alumnos?.find((r: any) => r.alumno_id === usuarioId);
      if (resp) {
        estado_alumno     = resp.estado;
        puntuacion_alumno = resp.puntuacion ?? null;
      } else {
        estado_alumno = 'NO_INICIADO';
      }
    }
 
    return {
      ...archivo,
      ejercicios: undefined,
      metadata_ejercicio: ejConfig ? {
        id_ejercicio:      ejConfig.id,
        fecha_inicio:      ejConfig.fecha_inicio,
        fecha_entrega:     ejConfig.fecha_entrega,
        solucion_pgn:      ejConfig.solucion_pgn,
        estado_alumno,
        puntuacion_alumno,
      } : undefined
    };
  }).filter((archivo: any) => archivo !== null);
 
  return archivosMapeados.sort((a: any, b: any) => {
    const obtenerPrioridad = (archivo: any) => {
      const metaEj = archivo.metadata_ejercicio;
      if (!metaEj) return 4;
      const { solucion_pgn, fecha_inicio, fecha_entrega } = metaEj;
      if (!solucion_pgn) return 0;
      if (fecha_inicio && new Date(fecha_inicio) > ahora) return 2;
      if (fecha_entrega && new Date(fecha_entrega) < ahora) return 3;
      return 1; // Activo
    };
 
    // Dentro de los Activos (prioridad 1), sub-ordenar por estado del alumno:
    // EN_PROGRESO (0) → NO_INICIADO (1) → COMPLETADO (2)
    const obtenerSubPrioridad = (archivo: any) => {
      const metaEj = archivo.metadata_ejercicio;
      if (!metaEj) return 0;
      switch (metaEj.estado_alumno) {
        case 'EN_PROGRESO': return 0;
        case 'NO_INICIADO': return 1;
        case 'COMPLETADO':  return 2;
        default:            return 1;
      }
    };
 
    const prioridadA = obtenerPrioridad(a);
    const prioridadB = obtenerPrioridad(b);
 
    if (prioridadA !== prioridadB) return prioridadA - prioridadB;
 
    // Mismo grupo — sub-ordenar solo dentro de Activos
    if (prioridadA === 1) {
      const subA = obtenerSubPrioridad(a);
      const subB = obtenerSubPrioridad(b);
      if (subA !== subB) return subA - subB;
    }
 
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

// Necesario para reconstruir el breadcrumb cuando el usuario accede directamente
// a una URL de database como /estudios/abc/db/xyz/ sin haber navegado desde la raíz
export const obtenerArchivoPorId = async (id: string, esProfesor: boolean) => {
  let query = supabaseAdmin
    .from('recursos_archivos')
    .select(`*, usuarios (nombre, apellidos)`)
    .eq('id', id)
    .single();

  const { data, error } = await query;

  if (error || !data) throw new Error('Archivo no encontrado.');

  // Si no es profesor y el archivo está oculto, denegar el acceso
  if (!esProfesor && !data.visible) {
    throw new Error('No tienes permiso para acceder a este archivo.');
  }

  return data;
};

export const actualizarVisibilidadArchivo = async (id: string, visible: boolean) => {
  const { data, error } = await supabaseAdmin
    .from('recursos_archivos')
    .update({ visible })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Error al actualizar archivo: ${error.message}`);
  return data;
};

export const eliminarArchivo = async (id: string) => {
  // Leer storage_path antes de borrar para limpiar también el fichero físico
  const { data: archivo } = await supabaseAdmin
    .from('recursos_archivos')
    .select('storage_path')
    .eq('id', id)
    .single();

  if (archivo?.storage_path) {
    await supabaseAdmin.storage
      .from('recursos_educativos')
      .remove([archivo.storage_path]);
  }

  const { error } = await supabaseAdmin
    .from('recursos_archivos')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Error al eliminar archivo: ${error.message}`);
  return true;
};