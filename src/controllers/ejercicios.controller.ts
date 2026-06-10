import { Request, Response } from 'express';
import * as ejerciciosService from '../services/ejercicios.service';
import { supabaseAdmin } from '../config/supabase';

// Helper buscar ejercicio_id a partir de archivo_id
async function getEjercicioId(archivoId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('ejercicios')
    .select('id')
    .eq('archivo_id', archivoId)
    .single();
  return data?.id ?? null;
}

// PROFESOR

export const subirEjercicio = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      carpeta_id, categoria, nombre, visible,
      solucion_pgn, fecha_inicio, fecha_entrega, comentarios_solucion, texto_fen_o_pgn,
    } = req.body;
    const profesor_id = (req as any).usuario?.id;
 
    let archivoBuffer  = req.file?.buffer;
    let mimeType       = req.file?.mimetype || 'text/plain';
    let nombreOriginal = req.file?.originalname || 'ejercicio_manual.pgn';
 
    if (!profesor_id) { res.status(401).json({ success: false, error: 'No autorizado.' }); return; }
    if (!carpeta_id || !categoria) { res.status(400).json({ success: false, error: 'Faltan datos obligatorios.' }); return; }
 
    if (!archivoBuffer && texto_fen_o_pgn) {
      const texto = texto_fen_o_pgn.trim();
 
      // Detectar si es FEN: no empieza por '[' ni contiene cabeceras PGN.
      // Un FEN puro tiene 6 campos separados por espacios y no comienza con '['.
      const esFen = !texto.startsWith('[') && !texto.startsWith('1.') && /^[rnbqkpRNBQKP1-8\/]+ [wb] /.test(texto);
 
      if (esFen) {
        // Envolver el FEN en un PGN mínimo con cabecera [FEN] para que chess.js
        // lo cargue correctamente y el tablero arranque desde esa posición.
        const pgnConFen = [
          `[Event "?"]`,
          `[Site "?"]`,
          `[Date "????.??.??"]`,
          `[Round "?"]`,
          `[White "?"]`,
          `[Black "?"]`,
          `[Result "*"]`,
          `[FEN "${texto}"]`,
          `[SetUp "1"]`,
          ``,
          `*`,
          ``,
        ].join('\n');
        archivoBuffer = Buffer.from(pgnConFen, 'utf-8');
      } else {
        // Es PGN directamente
        archivoBuffer = Buffer.from(texto, 'utf-8');
      }
    }
 
    if (!archivoBuffer) { res.status(400).json({ success: false, error: 'Falta archivo o texto FEN/PGN.' }); return; }
 
    const isVisible = visible !== undefined ? visible === 'true' || visible === true : true;
 
    const ejercicio = await ejerciciosService.crearEjercicio(
      archivoBuffer, nombreOriginal, mimeType,
      carpeta_id, profesor_id, categoria,
      nombre, isVisible,
      solucion_pgn, fecha_inicio, fecha_entrega, comentarios_solucion
    );
 
    res.status(201).json({ success: true, mensaje: 'Ejercicio creado con éxito', ejercicio });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const obtenerEjercicio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const usuario    = (req as any).usuario;
    const esProfesor = usuario?.rol === 'profesor';

    if (!id) { res.status(400).json({ success: false, error: 'ID inválido.' }); return; }

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }

    const ejercicio = await ejerciciosService.obtenerEjercicio(id, esProfesor);
    res.status(200).json({ success: true, ejercicio });
  } catch (error: any) {
    const status = error.message.includes('permiso') ? 403 : 404;
    res.status(status).json({ success: false, error: error.message });
  }
};

export const actualizarSolucion = async (req: Request, res: Response): Promise<void> => {
  try {
    const archivo_id = req.params.id; 
    const { solucion_pgn, comentarios_solucion } = req.body;

    // Buscar el ID interno del ejercicio y su solución actual
    const { data: ejercicio, error: errorBusqueda } = await supabaseAdmin
      .from('ejercicios')
      .select('id, solucion_pgn')
      .eq('archivo_id', archivo_id)
      .single();

    if (errorBusqueda || !ejercicio) {
      res.status(404).json({ success: false, error: 'No se encontró la configuración del ejercicio.' });
      return;
    }

    // Detectar si la solución se está regrabando (es decir, si ya había una solución previa y ahora se está cambiando)
    const esRegrabacion = ejercicio.solucion_pgn && (ejercicio.solucion_pgn !== solucion_pgn);

    // Actualiza la solución y el comentario en la base de datos
    await supabaseAdmin
      .from('ejercicios')
      .update({ solucion_pgn, comentarios_solucion })
      .eq('id', ejercicio.id);

    // Si cambió la solución, borra el progreso anterior
    if (esRegrabacion) {
      await supabaseAdmin
        .from('respuestas_alumnos')
        .delete()
        .eq('ejercicio_id', ejercicio.id);
    }

    if (!archivo_id || typeof archivo_id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }
    // Vuelve a matricular a todos 
    await ejerciciosService.verificarYAsignarAlumnos(archivo_id);

    // Devuelve en el JSON la variable 'regrabado' para que el Frontend lo sepa
    res.status(200).json({ 
      success: true, 
      regrabado: esRegrabacion, 
      mensaje: esRegrabacion ? 'Solución regrabada y progreso reiniciado.' : 'Solución guardada.' 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const actualizarFechas = async (req: Request, res: Response): Promise<void> => {
  try {
    const archivo_id = req.params.id; 
    const { fecha_inicio, fecha_entrega } = req.body;

    if (fecha_inicio && fecha_entrega) {
      if (new Date(fecha_inicio) > new Date(fecha_entrega)) {
        res.status(400).json({ success: false, error: 'La fecha de inicio no puede ser posterior a la de entrega.' });
        return;
      }
    }

    if (!archivo_id || typeof archivo_id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }

    await supabaseAdmin
      .from('ejercicios')
      .update({ fecha_inicio, fecha_entrega })
      .eq('archivo_id', archivo_id);
    
    await ejerciciosService.verificarYAsignarAlumnos(archivo_id);

    res.status(200).json({ success: true, mensaje: 'Fechas guardadas' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const asignarEjercicio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { asignado } = req.body;

    if (!id || typeof asignado !== 'boolean') {
      res.status(400).json({ success: false, error: 'Datos inválidos.' }); return;
    }

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }
    
    const resultado = await ejerciciosService.asignarEjercicio(id, asignado);
    res.status(200).json({ success: true, ejercicio: resultado });
  } catch (error: any) {
    const status = error.message.includes('sin solución') ? 422 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
};

export const listarRespuestas = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // archivo_id

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }

    const ejercicioId = await getEjercicioId(id);
    if (!ejercicioId) { res.status(404).json({ success: false, error: 'Ejercicio no encontrado.' }); return; }

    const respuestas = await ejerciciosService.obtenerRespuestasDeEjercicio(ejercicioId);
    res.status(200).json({ success: true, respuestas });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const evaluarAlumno = async (req: Request, res: Response): Promise<void> => {
  try {
    const { respuesta_id } = req.params;
    const profesor_id      = (req as any).usuario?.id;
    const { puntuacion, comentario } = req.body;

    if (!respuesta_id) { res.status(400).json({ success: false, error: 'ID de respuesta inválido.' }); return; }
    if (puntuacion === undefined) { res.status(400).json({ success: false, error: 'La puntuación es obligatoria.' }); return; }

    if (!respuesta_id || typeof respuesta_id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de respuesta inválido.' });
      return;
    }

    const evaluacion = await ejerciciosService.evaluarRespuesta(respuesta_id, profesor_id, puntuacion, comentario);
    res.status(200).json({ success: true, evaluacion });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ALUMNO

export const iniciarEjercicio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // archivo_id
    const alumno_id = (req as any).usuario?.id;

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }

    const ejercicioId = await getEjercicioId(id);
    if (!ejercicioId) { res.status(404).json({ success: false, error: 'Ejercicio no encontrado.' }); return; }

    const respuesta = await ejerciciosService.iniciarEjercicioAlumno(ejercicioId, alumno_id);
    res.status(200).json({ success: true, respuesta });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const obtenerMiProgreso = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // archivo_id
    const alumno_id = (req as any).usuario?.id;

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }

    const ejercicioId = await getEjercicioId(id);
    if (!ejercicioId) { res.status(404).json({ success: false, error: 'Ejercicio no encontrado.' }); return; }

    const progreso = await ejerciciosService.obtenerProgresoAlumno(ejercicioId, alumno_id);
    res.status(200).json({ success: true, progreso }); // progreso puede ser null si no ha iniciado
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const actualizarMovimiento = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // archivo_id
    const alumno_id = (req as any).usuario?.id;
    const { es_correcto, pgn_actualizado, es_final } = req.body;

    if (typeof es_correcto !== 'boolean' || !pgn_actualizado) {
      res.status(400).json({ success: false, error: 'Datos de movimiento inválidos.' }); return;
    }

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }
    
    const ejercicioId = await getEjercicioId(id);
    if (!ejercicioId) { res.status(404).json({ success: false, error: 'Ejercicio no encontrado.' }); return; }

    await ejerciciosService.registrarMovimientoAlumno(ejercicioId, alumno_id, es_correcto, pgn_actualizado, es_final ?? false);
    res.status(200).json({ success: true, mensaje: 'Progreso guardado.' });
  } catch (error: any) {
 
    if (error.message === 'EJERCICIO_VENCIDO') {
      res.status(403).json({ success: false, error: 'El ejercicio ha vencido. No se pueden guardar más respuestas.' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

export const guardarComentarioAlumno = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // archivo_id
    const alumno_id  = (req as any).usuario?.id;
    const { comentario } = req.body;

    if (!comentario) { res.status(400).json({ success: false, error: 'El comentario no puede estar vacío.' }); return; }

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' });
      return;
    }

    const ejercicioId = await getEjercicioId(id);
    if (!ejercicioId) { res.status(404).json({ success: false, error: 'Ejercicio no encontrado.' }); return; }

    const resultado = await ejerciciosService.guardarComentarioAlumno(ejercicioId, alumno_id, comentario);
    res.status(200).json({ success: true, respuesta: resultado });
  } catch (error: any) {

    if (error.message === 'EJERCICIO_VENCIDO') {
      res.status(403).json({ success: false, error: 'El ejercicio ha vencido. No se puede guardar el comentario.' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};