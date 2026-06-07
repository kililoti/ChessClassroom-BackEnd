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
  visible: boolean = true
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
      visible
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
  // 1. Buscamos la ruta del archivo en la BD
  const { data: archivo, error: dbError } = await supabaseAdmin
    .from('recursos_archivos')
    .select('storage_path, visible')
    .eq('id', archivoId)
    .single();

  if (dbError || !archivo) throw new Error('Archivo no encontrado.');
  if (!archivo.storage_path) throw new Error('Este recurso no tiene un archivo físico asociado.');

  // 2. Generamos la URL firmada válida por 60 segundos
  const { data: urlData, error: urlError } = await supabaseAdmin.storage
    .from('recursos_educativos')
    .createSignedUrl(archivo.storage_path, 60);

  if (urlError) throw new Error(`Error al generar enlace: ${urlError.message}`);

  return urlData.signedUrl;
};

export const obtenerArchivosDeCarpeta = async (carpetaId: string, esProfesor: boolean) => {
  // Construimos la consulta base
  let query = supabaseAdmin
    .from('recursos_archivos')
    .select(`
      *,
      usuarios (nombre, apellidos)
    `)
    .eq('carpeta_id', carpetaId)
    .order('created_at', { ascending: false });

  // 🛡️ EL ESCUDO DE SEGURIDAD
  // Si NO es profesor, aplicamos el filtro. Si SÍ es profesor, lo ignoramos para que traiga todo.
  if (!esProfesor) {
    query = query.eq('visible', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error SQL en archivos:", error);
    throw new Error(error.message);
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
  // Opcional: Si los PGN los subes al Storage de Supabase, aquí tendrías que 
  // leer primero el `storage_path` del archivo y borrarlo del bucket.
  
  const { error } = await supabaseAdmin
    .from('recursos_archivos')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Error al eliminar archivo: ${error.message}`);
  }
  
  return true;
};