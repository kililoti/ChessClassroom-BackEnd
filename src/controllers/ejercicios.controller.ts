import { Request, Response } from 'express';
import * as ejerciciosService from '../services/ejercicios.service';
import { supabaseAdmin } from '../config/supabase';

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
      const esFen = !texto.startsWith('[') && !texto.startsWith('1.') && /^[rnbqkpRNBQKP1-8\/]+ [wb] /.test(texto);
      if (esFen) {
        const pgnConFen = [
          `[Event "?"]`, `[Site "?"]`, `[Date "????.??.??"]`,
          `[Round "?"]`, `[White "?"]`, `[Black "?"]`,
          `[Result "*"]`, `[FEN "${texto}"]`, `[SetUp "1"]`, ``, `*`, ``,
        ].join('\n');
        archivoBuffer = Buffer.from(pgnConFen, 'utf-8');
      } else {
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
    const esProfesor = (req as any).usuario?.rol === 'profesor';

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID inválido.' }); return;
    }

    const ejercicio = await ejerciciosService.obtenerEjercicio(id, esProfesor);
    res.status(200).json({ success: true, ejercicio });
  } catch (error: any) {
    const status = error.message.includes('permiso') ? 403 : 404;
    res.status(status).json({ success: false, error: error.message });
  }
};

// PARA DATABASES: devuelve todos los ejercicios de un archivo
export const obtenerEjerciciosPorArchivo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { archivo_id } = req.params;
    const esProfesor = (req as any).usuario?.rol === 'profesor';
    const usuarioId  = (req as any).usuario?.id;

    if (!archivo_id || typeof archivo_id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de archivo inválido.' }); return;
    }

    const ejercicios = await ejerciciosService.obtenerEjerciciosPorArchivo(archivo_id, esProfesor, usuarioId);
    res.status(200).json({ success: true, ejercicios });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const actualizarSolucion = async (req: Request, res: Response): Promise<void> => {
  try {
    const ejercicioId = req.params.id;
    const { solucion_pgn, comentarios_solucion } = req.body;

    if (!ejercicioId || typeof ejercicioId !== 'string') {
      res.status(400).json({ success: false, error: 'ID inválido.' }); return;
    }

    const { data: ejercicio, error: errorBusqueda } = await supabaseAdmin
      .from('ejercicios')
      .select('id, solucion_pgn')
      .eq('id', ejercicioId)
      .single();

    if (errorBusqueda || !ejercicio) {
      res.status(404).json({ success: false, error: 'No se encontró la configuración del ejercicio.' }); return;
    }

    const esRegrabacion = ejercicio.solucion_pgn && (ejercicio.solucion_pgn !== solucion_pgn);

    await supabaseAdmin
      .from('ejercicios')
      .update({ solucion_pgn, comentarios_solucion })
      .eq('id', ejercicio.id);

    if (esRegrabacion) {
      await supabaseAdmin
        .from('respuestas_alumnos')
        .delete()
        .eq('ejercicio_id', ejercicio.id);
    }

    const asignado = await ejerciciosService.verificarYAsignarAlumnos(ejercicioId);

    res.status(200).json({
      success: true,
      regrabado: esRegrabacion,
      asignado,
      mensaje: esRegrabacion ? 'Solución regrabada y progreso reiniciado.' : 'Solución guardada.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const actualizarFechas = async (req: Request, res: Response): Promise<void> => {
  try {
    const ejercicioId = req.params.id;
    const { fecha_inicio, fecha_entrega } = req.body;

    if (fecha_inicio && fecha_entrega && new Date(fecha_inicio) > new Date(fecha_entrega)) {
      res.status(400).json({ success: false, error: 'La fecha de inicio no puede ser posterior a la de entrega.' }); return;
    }

    if (!ejercicioId || typeof ejercicioId !== 'string') {
      res.status(400).json({ success: false, error: 'ID inválido.' }); return;
    }

    await supabaseAdmin
      .from('ejercicios')
      .update({ fecha_inicio, fecha_entrega })
      .eq('id', ejercicioId);

    const asignado = await ejerciciosService.verificarYAsignarAlumnos(ejercicioId);

    res.status(200).json({ success: true, asignado, mensaje: 'Fechas guardadas' });
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
      res.status(400).json({ success: false, error: 'ID de ejercicio inválido.' }); return;
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
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID inválido.' }); return;
    }

    const respuestas = await ejerciciosService.obtenerRespuestasDeEjercicio(id);
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

    const { data: respuesta, error: errResp } = await supabaseAdmin
      .from('respuestas_alumnos')
      .select('estado, ejercicio_id')
      .eq('id', respuesta_id)
      .single();

    if (errResp || !respuesta) {
      res.status(404).json({ success: false, error: 'Respuesta no encontrada.' }); return;
    }

    const { data: ejercicio } = await supabaseAdmin
      .from('ejercicios')
      .select('fecha_entrega')
      .eq('id', respuesta.ejercicio_id)
      .single();

    const fechaVencida   = ejercicio?.fecha_entrega ? new Date() > new Date(ejercicio.fecha_entrega) : false;
    const alumnoCompletó = respuesta.estado === 'COMPLETADO';

    if (!alumnoCompletó && !fechaVencida) {
      res.status(403).json({
        success: false,
        error: 'Solo se puede evaluar cuando el alumno ha completado el ejercicio o ha pasado la fecha de entrega.',
      }); return;
    }

    if (!respuesta_id || typeof respuesta_id !== 'string') {
      res.status(400).json({ success: false, error: 'ID de respuesta inválido.' }); return;
    }

    const evaluacion = await ejerciciosService.evaluarRespuesta(respuesta_id, profesor_id, puntuacion, comentario);
    res.status(200).json({ success: true, evaluacion });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const eliminarEjercicio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID inválido.' }); return;
    }

    // Borrar respuestas_alumnos asociadas
    await supabaseAdmin.from('respuestas_alumnos').delete().eq('ejercicio_id', id);

    // Borrar la fila de ejercicios
    const { error } = await supabaseAdmin.from('ejercicios').delete().eq('id', id);
    if (error) throw new Error(error.message);

    res.status(200).json({ success: true, mensaje: 'Ejercicio eliminado.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ALUMNO

export const iniciarEjercicio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const alumno_id = (req as any).usuario?.id;

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID inválido.' }); return;
    }

    const respuesta = await ejerciciosService.iniciarEjercicioAlumno(id, alumno_id);
    res.status(200).json({ success: true, respuesta });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const obtenerMiProgreso = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const alumno_id = (req as any).usuario?.id;

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID inválido.' }); return;
    }

    const progreso = await ejerciciosService.obtenerProgresoAlumno(id, alumno_id);
    res.status(200).json({ success: true, progreso });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const actualizarMovimiento = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const alumno_id = (req as any).usuario?.id;
    const { es_correcto, pgn_actualizado, es_final } = req.body;

    if (typeof es_correcto !== 'boolean' || !pgn_actualizado) {
      res.status(400).json({ success: false, error: 'Datos de movimiento inválidos.' }); return;
    }

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID inválido.' }); return;
    }

    await ejerciciosService.registrarMovimientoAlumno(id, alumno_id, es_correcto, pgn_actualizado, es_final ?? false);
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
    const { id } = req.params;
    const alumno_id  = (req as any).usuario?.id;
    const { comentario } = req.body;

    if (!comentario) { res.status(400).json({ success: false, error: 'El comentario no puede estar vacío.' }); return; }

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID inválido.' }); return;
    }

    const resultado = await ejerciciosService.guardarComentarioAlumno(id, alumno_id, comentario);
    res.status(200).json({ success: true, respuesta: resultado });
  } catch (error: any) {
    if (error.message === 'EJERCICIO_VENCIDO') {
      res.status(403).json({ success: false, error: 'El ejercicio ha vencido. No se puede guardar el comentario.' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

export const guardarTiempo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const alumno_id = (req as any).usuario?.id;
    const { segundos } = req.body;

    if (typeof segundos !== 'number' || segundos <= 0) {
      res.status(400).json({ success: false, error: 'Segundos inválidos.' }); return;
    }

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'ID inválido.' }); return;
    }

    await ejerciciosService.guardarTiempoAlumno(id, alumno_id, segundos);
    res.status(200).json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};