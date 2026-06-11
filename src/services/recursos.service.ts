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
  usuarioId?: string,
  modulo?: string
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
    const ejercicios = Array.isArray(archivo.ejercicios) ? archivo.ejercicios : [archivo.ejercicios].filter(Boolean);

    const esModoEjercicio = modulo === 'ejercicio';

    const ejerciciosValidos = (esModoEjercicio && !esProfesor)
      ? ejercicios.filter((e: any) => e && e.solucion_pgn && e.fecha_inicio && e.fecha_entrega)
      : ejercicios;

    if (esModoEjercicio && !esProfesor && ejerciciosValidos.length === 0) {
      return null;
    }

    const ejConfig = ejerciciosValidos[0] || ejercicios[0];

    let estado_alumno     = undefined;
    let puntuacion_alumno = undefined;

    if (ejConfig && !esProfesor && usuarioId) {
      const resp = ejConfig.respuestas_alumnos?.find((r: any) => r.alumno_id === usuarioId);
      estado_alumno     = resp ? resp.estado : 'NO_INICIADO';
      puntuacion_alumno = resp?.puntuacion ?? null;
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
      return 1;
    };

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

    if (prioridadA === 1) {
      const subA = obtenerSubPrioridad(a);
      const subB = obtenerSubPrioridad(b);
      if (subA !== subB) return subA - subB;
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

export const obtenerArchivoPorId = async (id: string, esProfesor: boolean) => {
  const { data, error } = await supabaseAdmin
    .from('recursos_archivos')
    .select(`*, usuarios (nombre, apellidos)`)
    .eq('id', id)
    .single();

  if (error || !data) throw new Error('Archivo no encontrado.');
  if (!esProfesor && !data.visible) throw new Error('No tienes permiso para acceder a este archivo.');

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


// ELIMINAR MÚLTIPLES PARTIDAS DE DATABASE (modo estudio, optimizado)

export const eliminarPartidasDeArchivoEstudio = async (
  archivoId: string,
  partidaIndices: number[],
) => {
  if (partidaIndices.length === 0) return { partidasRestantes: 0 };

  const { data: archivo, error: errArc } = await supabaseAdmin
    .from('recursos_archivos')
    .select('storage_path, metadata')
    .eq('id', archivoId)
    .single();

  if (errArc || !archivo) throw new Error('Archivo no encontrado.');

  const { data: fileData, error: errDown } = await supabaseAdmin.storage
    .from('recursos_educativos')
    .download(archivo.storage_path);

  if (errDown || !fileData) throw new Error(`Error al descargar el PGN: ${errDown?.message}`);

  const pgnCompleto = await fileData.text();
  const bloques     = pgnCompleto.split(/(?=\[Event\s)/g).filter(b => b.trim().length > 0);

  const indicesAEliminar = new Set(partidaIndices);
  const bloquesRestantes = bloques.filter((_: string, i: number) => !indicesAEliminar.has(i));

  const { error: errUp } = await supabaseAdmin.storage
    .from('recursos_educativos')
    .update(archivo.storage_path, Buffer.from(bloquesRestantes.join('\n'), 'utf-8'), {
      contentType: 'text/plain',
      upsert: true,
    });

  if (errUp) throw new Error(`Error al resubir el PGN: ${errUp.message}`);

  const nuevasPartidas = bloquesRestantes.map((bloque: string, index: number) => {
    const get = (tag: string) => bloque.match(new RegExp(`\\[${tag}\\s+"([^"]*)"\\]`))?.[1] ?? '?';
    return { index, evento: get('Event'), blancas: get('White'), negras: get('Black'), fecha: get('Date'), resultado: get('Result') };
  });

  await supabaseAdmin
    .from('recursos_archivos')
    .update({
      metadata: {
        ...(archivo.metadata ?? {}),
        partidas:       nuevasPartidas,
        total_partidas: bloquesRestantes.length,
        es_base_datos:  bloquesRestantes.length > 1,
      },
    })
    .eq('id', archivoId);

  return { partidasRestantes: bloquesRestantes.length };
};


// TOGGLE VISIBILIDAD DE PARTIDA INDIVIDUAL (modo estudio)

export const toggleVisibilidadPartida = async (
  archivoId: string,
  partidaIndex: number,
) => {
  const { data: archivo, error } = await supabaseAdmin
    .from('recursos_archivos')
    .select('metadata')
    .eq('id', archivoId)
    .single();

  if (error || !archivo) throw new Error('Archivo no encontrado.');

  const metadata        = archivo.metadata ?? {};
  const ocultas: number[] = metadata.partidas_ocultas ?? [];

  const nuevasOcultas = ocultas.includes(partidaIndex)
    ? ocultas.filter((i: number) => i !== partidaIndex) // mostrar
    : [...ocultas, partidaIndex];                        // ocultar

  await supabaseAdmin
    .from('recursos_archivos')
    .update({ metadata: { ...metadata, partidas_ocultas: nuevasOcultas } })
    .eq('id', archivoId);

  return { oculta: nuevasOcultas.includes(partidaIndex), partidas_ocultas: nuevasOcultas };
};

// ELIMINAR PARTIDA INDIVIDUAL DE DATABASE (modo estudio)
// Descarga el PGN, elimina el bloque, resubé y actualiza metadata.
// No toca la tabla ejercicios (solo aplica a estudios).

export const eliminarPartidaDeArchivoEstudio = async (
  archivoId: string,
  partidaIndex: number,
) => {
  // Obtener el archivo
  const { data: archivo, error: errArc } = await supabaseAdmin
    .from('recursos_archivos')
    .select('storage_path, metadata')
    .eq('id', archivoId)
    .single();

  if (errArc || !archivo) throw new Error('Archivo no encontrado.');

  // Descargar el PGN
  const { data: fileData, error: errDown } = await supabaseAdmin.storage
    .from('recursos_educativos')
    .download(archivo.storage_path);

  if (errDown || !fileData) throw new Error(`Error al descargar el PGN: ${errDown?.message}`);

  const pgnCompleto = await fileData.text();
  const bloques     = pgnCompleto.split(/(?=\[Event\s)/g).filter(b => b.trim().length > 0);

  if (partidaIndex < 0 || partidaIndex >= bloques.length) {
    throw new Error(`partida_index ${partidaIndex} fuera de rango (${bloques.length} partidas).`);
  }

  // Eliminar el bloque
  bloques.splice(partidaIndex, 1);

  // Resubir
  const { error: errUp } = await supabaseAdmin.storage
    .from('recursos_educativos')
    .update(archivo.storage_path, Buffer.from(bloques.join('\n'), 'utf-8'), {
      contentType: 'text/plain',
      upsert: true,
    });

  if (errUp) throw new Error(`Error al resubir el PGN: ${errUp.message}`);

  // Recalcular metadata
  const nuevasPartidas = bloques.map((bloque, index) => {
    const get = (tag: string) => bloque.match(new RegExp(`\\[${tag}\\s+"([^"]*)"\\]`))?.[1] ?? '?';
    return {
      index,
      evento:    get('Event'),
      blancas:   get('White'),
      negras:    get('Black'),
      fecha:     get('Date'),
      resultado: get('Result'),
    };
  });

  await supabaseAdmin
    .from('recursos_archivos')
    .update({
      metadata: {
        ...(archivo.metadata ?? {}),
        partidas:       nuevasPartidas,
        total_partidas: bloques.length,
        es_base_datos:  bloques.length > 1,
      },
    })
    .eq('id', archivoId);

  return { partidasRestantes: bloques.length };
};