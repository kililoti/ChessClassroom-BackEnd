import { supabaseAdmin } from '../config/supabase';

const BUCKET = 'recursos_educativos';
const MAX_TAMANIO_BYTES = 50 * 1024 * 1024; // 50 MB

// ── Helpers ───────────────────────────────────────────────

/**
 * Extrae el ID de un vídeo de YouTube de cualquier formato de URL habitual:
 * - https://www.youtube.com/watch?v=XXXXXXXXXXX
 * - https://youtu.be/XXXXXXXXXXX
 * - https://www.youtube.com/embed/XXXXXXXXXXX
 * - https://www.youtube.com/watch?v=XXXXXXXXXXX&list=...  (vídeos no listados con lista)
 */
export const extraerYoutubeId = (url: string): string | null => {
  const patrones = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const patron of patrones) {
    const match = url.match(patron);
    if (match) return match[1];
  }
  return null;
};

// ── Subida de foto/vídeo ──────────────────────────────────

export const subirMaterialArchivo = async (
  archivoBuffer: Buffer,
  nombreOriginal: string,
  mimeType: string,
  carpetaId: string,
  profesorId: string,
  nombre: string,
  tipo: 'foto' | 'video',
  miniaturaBuffer?: Buffer,
  miniaturaMime?: string,
) => {
  if (archivoBuffer.length > MAX_TAMANIO_BYTES) {
    throw new Error('El archivo supera el tamaño máximo permitido de 50MB.');
  }

  const timestamp = Date.now();
  const storagePath = `materiales/${profesorId}/${timestamp}_${nombreOriginal}`;

  const { error: storageError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, archivoBuffer, { contentType: mimeType, upsert: false });

  if (storageError) throw new Error(`Error en Storage: ${storageError.message}`);

  // Subir miniatura si se proporcionó
  let miniaturaPath: string | null = null;
  if (miniaturaBuffer && miniaturaMime) {
    miniaturaPath = `materiales/${profesorId}/${timestamp}_miniatura`;
    const { error: errMini } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(miniaturaPath, miniaturaBuffer, { contentType: miniaturaMime, upsert: false });

    if (errMini) {
      // No bloquear la subida del material si falla la miniatura, solo avisar
      console.warn('No se pudo subir la miniatura:', errMini.message);
      miniaturaPath = null;
    }
  }

  const { data: registro, error: dbError } = await supabaseAdmin
    .from('materiales')
    .insert({
      nombre,
      carpeta_id: carpetaId,
      profesor_id: profesorId,
      tipo,
      storage_path: storagePath,
      tamanio: archivoBuffer.length,
      miniatura_path: miniaturaPath,
      visible: true,
    })
    .select()
    .single();

  if (dbError) {
    await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
    if (miniaturaPath) await supabaseAdmin.storage.from(BUCKET).remove([miniaturaPath]);
    throw new Error(`Error en Base de Datos: ${dbError.message}`);
  }

  return registro;
};

// ── Añadir vídeo de YouTube ────────────────────────────────

export const subirMaterialYoutube = async (
  carpetaId: string,
  profesorId: string,
  nombre: string,
  youtubeUrl: string,
  miniaturaBuffer?: Buffer,
  miniaturaMime?: string,
) => {
  const youtubeId = extraerYoutubeId(youtubeUrl);
  if (!youtubeId) throw new Error('La URL de YouTube no es válida.');

  let miniaturaPath: string | null = null;

  if (miniaturaBuffer && miniaturaMime) {
    const timestamp = Date.now();
    miniaturaPath = `materiales/${profesorId}/${timestamp}_miniatura`;
    const { error: errMini } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(miniaturaPath, miniaturaBuffer, { contentType: miniaturaMime, upsert: false });

    if (errMini) {
      console.warn('No se pudo subir la miniatura:', errMini.message);
      miniaturaPath = null;
    }
  }

  // Miniatura por defecto de YouTube (si el profesor no sube una propia)
  // hqdefault siempre existe para vídeos públicos y no listados
  const miniaturaUrlYoutube = miniaturaPath ? null : `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

  const { data: registro, error: dbError } = await supabaseAdmin
    .from('materiales')
    .insert({
      nombre,
      carpeta_id: carpetaId,
      profesor_id: profesorId,
      tipo: 'youtube',
      youtube_url: youtubeUrl,
      youtube_id: youtubeId,
      miniatura_path: miniaturaPath,
      miniatura_url: miniaturaUrlYoutube,
      visible: true,
    })
    .select()
    .single();

  if (dbError) {
    if (miniaturaPath) await supabaseAdmin.storage.from(BUCKET).remove([miniaturaPath]);
    throw new Error(`Error en Base de Datos: ${dbError.message}`);
  }

  return registro;
};

// ── Lectura ───────────────────────────────────────────────

export const obtenerMaterialesDeCarpeta = async (carpetaId: string, esProfesor: boolean) => {
  let query = supabaseAdmin
    .from('materiales')
    .select('*')
    .eq('carpeta_id', carpetaId)
    .order('created_at', { ascending: false });

  if (!esProfesor) query = query.eq('visible', true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
};

export const obtenerMaterialPorId = async (id: string, esProfesor: boolean) => {
  const { data, error } = await supabaseAdmin
    .from('materiales')
    .select(`*, usuarios (nombre, apellidos)`)
    .eq('id', id)
    .single();

  if (error || !data) throw new Error('Material no encontrado.');
  if (!esProfesor && !data.visible) throw new Error('No tienes permiso para acceder a este material.');

  return data;
};

// ── URLs firmadas ─────────────────────────────────────────

export const generarUrlMaterial = async (id: string) => {
  const { data: material, error } = await supabaseAdmin
    .from('materiales')
    .select('storage_path, tipo')
    .eq('id', id)
    .single();

  if (error || !material) throw new Error('Material no encontrado.');
  if (!material.storage_path) throw new Error('Este material no tiene un archivo físico (es un vídeo de YouTube).');

  const { data: urlData, error: urlError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(material.storage_path, 3600); // 1 hora — vídeos pueden tardar en reproducirse

  if (urlError) throw new Error(`Error al generar enlace: ${urlError.message}`);
  return urlData.signedUrl;
};

export const generarUrlMiniatura = async (id: string) => {
  const { data: material, error } = await supabaseAdmin
    .from('materiales')
    .select('miniatura_path, miniatura_url, storage_path, tipo')
    .eq('id', id)
    .single();

  if (error || !material) throw new Error('Material no encontrado.');

  // Miniatura externa (YouTube) — devolver directamente
  if (material.miniatura_url) return material.miniatura_url;

  // Miniatura subida manualmente
  if (material.miniatura_path) {
    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(material.miniatura_path, 3600);
    if (urlError) throw new Error(urlError.message);
    return urlData.signedUrl;
  }

  // Si es una foto sin miniatura propia, usar la propia foto como miniatura
  if (material.tipo === 'foto' && material.storage_path) {
    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(material.storage_path, 3600);
    if (urlError) throw new Error(urlError.message);
    return urlData.signedUrl;
  }

  // Sin miniatura disponible — el frontend usará la imagen por defecto de ajedrez
  return null;
};

// ── Actualizar / eliminar ─────────────────────────────────

export const actualizarVisibilidadMaterial = async (id: string, visible: boolean) => {
  const { data, error } = await supabaseAdmin
    .from('materiales')
    .update({ visible })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Error al actualizar material: ${error.message}`);
  return data;
};

export const renombrarMaterial = async (id: string, nombre: string) => {
  if (!nombre.trim()) throw new Error('El nombre no puede estar vacío.');

  const { data, error } = await supabaseAdmin
    .from('materiales')
    .update({ nombre: nombre.trim() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Error al renombrar material: ${error.message}`);
  return data;
};

export const eliminarMaterial = async (id: string) => {
  const { data: material } = await supabaseAdmin
    .from('materiales')
    .select('storage_path, miniatura_path')
    .eq('id', id)
    .single();

  const rutasABorrar: string[] = [];
  if (material?.storage_path) rutasABorrar.push(material.storage_path);
  if (material?.miniatura_path) rutasABorrar.push(material.miniatura_path);

  if (rutasABorrar.length > 0) {
    await supabaseAdmin.storage.from(BUCKET).remove(rutasABorrar);
  }

  const { error } = await supabaseAdmin
    .from('materiales')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Error al eliminar material: ${error.message}`);
  return true;
};