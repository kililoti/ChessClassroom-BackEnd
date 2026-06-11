import { supabaseAdmin } from '../config/supabase';
import * as recursosService from './recursos.service';

// CREAR EJERCICIO (PROFESOR)
// Si el PGN tiene N partidas (database), crea N filas en ejercicios.

export const crearEjercicio = async (
  archivoBuffer: Buffer,
  nombreOriginal: string,
  mimeType: string,
  carpetaId: string,
  profesorId: string,
  categoria: string,
  nombrePersonalizado?: string,
  visible: boolean = true,
  solucionPgn?: string,
  fechaInicio?: string,
  fechaEntrega?: string,
  comentariosSolucion?: string,
) => {
  const archivoBase = await recursosService.procesarYSubirPGN(
    archivoBuffer, nombreOriginal, mimeType,
    carpetaId, profesorId, categoria,
    nombrePersonalizado, visible,
    'ejercicio'
  );

  const totalPartidas = archivoBase.metadata?.total_partidas ?? 1;

  const insertData = Array.from({ length: totalPartidas }, (_, i) => ({
    archivo_id:           archivoBase.id,
    partida_index:        i,
    fecha_inicio:         fechaInicio || null,
    fecha_entrega:        fechaEntrega || null,
    solucion_pgn:         solucionPgn || null,
    comentarios_solucion: comentariosSolucion || null,
    asignado:             false,
  }));

  const { data: ejercicios, error } = await supabaseAdmin
    .from('ejercicios')
    .insert(insertData)
    .select();

  if (error) throw new Error(`Error al crear ejercicios: ${error.message}`);
  return { ...archivoBase, ejercicios_config: ejercicios };
};

// OBTENER EJERCICIO COMPLETO

export const obtenerEjercicio = async (ejercicioId: string, esProfesor: boolean) => {
  const { data: ejercicio, error } = await supabaseAdmin
    .from('ejercicios')
    .select(`
      *,
      recursos_archivos!inner(*, usuarios(nombre, apellidos))
    `)
    .eq('id', ejercicioId)
    .single();

  if (error || !ejercicio) throw new Error('Ejercicio no encontrado.');

  const archivo = ejercicio.recursos_archivos as any;
  if (!esProfesor && !archivo.visible) throw new Error('No tienes permiso para acceder a este ejercicio.');

  return {
    ...archivo,
    archivo_id: archivo.id,
    ejercicio_config: {
      id:                   ejercicio.id,
      partida_index:        ejercicio.partida_index,
      fecha_inicio:         ejercicio.fecha_inicio,
      fecha_entrega:        ejercicio.fecha_entrega,
      solucion_pgn:         ejercicio.solucion_pgn,
      comentarios_solucion: ejercicio.comentarios_solucion,
      asignado:             ejercicio.asignado,
    },
  };
};

// PARA DATABASES: OBTIENE TODOS LOS EJERCICIOS DE UN ARCHIVO

export const obtenerEjerciciosPorArchivo = async (
  archivoId: string,
  esProfesor: boolean,
  usuarioId?: string,
) => {
  const { data, error } = await supabaseAdmin
    .from('ejercicios')
    .select(`
      id,
      partida_index,
      fecha_inicio,
      fecha_entrega,
      solucion_pgn,
      respuestas_alumnos (
        alumno_id,
        estado,
        puntuacion
      )
    `)
    .eq('archivo_id', archivoId)
    .order('partida_index', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((ej: any) => {
    // Si es alumno, ocultar ejercicios sin solución + fecha_inicio + fecha_entrega
    if (!esProfesor && (!ej.solucion_pgn || !ej.fecha_inicio || !ej.fecha_entrega)) {
      return null;
    }

    let estado_alumno:     string | undefined;
    let puntuacion_alumno: number | null | undefined;

    if (!esProfesor && usuarioId) {
      const resp = ej.respuestas_alumnos?.find((r: any) => r.alumno_id === usuarioId);
      if (resp) {
        estado_alumno     = resp.estado;
        puntuacion_alumno = resp.puntuacion ?? null;
      } else {
        estado_alumno = 'NO_INICIADO';
      }
    }

    return {
      id:               ej.id,
      partida_index:    ej.partida_index,
      fecha_inicio:     ej.fecha_inicio,
      fecha_entrega:    ej.fecha_entrega,
      solucion_pgn:     ej.solucion_pgn,
      estado_alumno,
      puntuacion_alumno,
    };
  }).filter((ej: any) => ej !== null);
};
// ACTUALIZAR SOLUCIÓN (PROFESOR)

export const actualizarSolucion = async (
  archivoId: string,
  solucionPgn: string,
  comentariosSolucion?: string,
) => {
  const { data: ejercicio, error: errorBusqueda } = await supabaseAdmin
    .from('ejercicios')
    .select('id')
    .eq('archivo_id', archivoId)
    .single();

  if (errorBusqueda || !ejercicio) throw new Error('Ejercicio no encontrado.');

  const { data, error } = await supabaseAdmin
    .from('ejercicios')
    .update({
      solucion_pgn:         solucionPgn,
      comentarios_solucion: comentariosSolucion ?? null,
    })
    .eq('id', ejercicio.id)
    .select()
    .single();

  if (error) throw new Error(`Error al actualizar solución: ${error.message}`);
  return data;
};

// ACTUALIZAR FECHA DE ENTREGA

export const actualizarFechaEntrega = async (
  archivoId: string,
  fechaEntrega: string | null,
) => {
  const { data: ejercicio, error: errorBusqueda } = await supabaseAdmin
    .from('ejercicios')
    .select('id')
    .eq('archivo_id', archivoId)
    .single();

  if (errorBusqueda || !ejercicio) throw new Error('Ejercicio no encontrado.');

  const { data, error } = await supabaseAdmin
    .from('ejercicios')
    .update({ fecha_entrega: fechaEntrega })
    .eq('id', ejercicio.id)
    .select()
    .single();

  if (error) throw new Error(`Error al actualizar fecha: ${error.message}`);
  return data;
};

// ASIGNAR / DESASIGNAR EJERCICIO

export const asignarEjercicio = async (archivoId: string, asignado: boolean) => {
  const { data: ejercicio, error: errorBusqueda } = await supabaseAdmin
    .from('ejercicios')
    .select('id, solucion_pgn')
    .eq('archivo_id', archivoId)
    .single();

  if (errorBusqueda || !ejercicio) throw new Error('Ejercicio no encontrado.');
  if (asignado && !ejercicio.solucion_pgn) throw new Error('No se puede asignar un ejercicio sin solución definida.');

  const { data, error } = await supabaseAdmin
    .from('ejercicios')
    .update({ asignado })
    .eq('id', ejercicio.id)
    .select()
    .single();

  if (error) throw new Error(`Error al asignar ejercicio: ${error.message}`);
  return data;
};

// INICIAR EJERCICIO (ALUMNO)

export const iniciarEjercicioAlumno = async (ejercicioId: string, alumnoId: string) => {
  const { data: existente } = await supabaseAdmin
    .from('respuestas_alumnos')
    .select('*')
    .eq('ejercicio_id', ejercicioId)
    .eq('alumno_id', alumnoId)
    .single();

  if (existente) {
    if (!existente.fecha_primer_acceso) {
      const { data: actualizado, error } = await supabaseAdmin
        .from('respuestas_alumnos')
        .update({
          fecha_primer_acceso: new Date().toISOString(),
          estado: 'EN_PROGRESO',
        })
        .eq('id', existente.id)
        .select()
        .single();

      if (error) throw new Error(`Error al iniciar el ejercicio: ${error.message}`);
      return actualizado;
    }
    return existente;
  }

  const { data: nuevo, error } = await supabaseAdmin
    .from('respuestas_alumnos')
    .insert({
      ejercicio_id:        ejercicioId,
      alumno_id:           alumnoId,
      estado:              'EN_PROGRESO',
      fecha_primer_acceso: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Error al iniciar el ejercicio: ${error.message}`);
  return nuevo;
};

// OBTENER PROGRESO DEL ALUMNO

export const obtenerProgresoAlumno = async (ejercicioId: string, alumnoId: string) => {
  const { data, error } = await supabaseAdmin
    .from('respuestas_alumnos')
    .select('*')
    .eq('ejercicio_id', ejercicioId)
    .eq('alumno_id', alumnoId)
    .single();

  if (error) return null;
  return data;
};

// REGISTRAR MOVIMIENTO (ALUMNO)

export const registrarMovimientoAlumno = async (
  ejercicioId: string,
  alumnoId: string,
  esCorrecto: boolean,
  pgnActualizado: string,
  esFinal: boolean = false,
) => {
  const { data: ejercicio, error: errEj } = await supabaseAdmin
    .from('ejercicios')
    .select('fecha_entrega')
    .eq('id', ejercicioId)
    .single();

  if (errEj) throw new Error(`Error al verificar ejercicio: ${errEj.message}`);

  if (ejercicio?.fecha_entrega) {
    const vencimiento = new Date(ejercicio.fecha_entrega);
    const ahora = new Date();
    if (ahora > vencimiento) throw new Error('EJERCICIO_VENCIDO');
  }

  const updateData: Record<string, any> = { pgn_ultimo_movimiento: pgnActualizado };

  if (esCorrecto) {
    updateData.pgn_avanzado_correcto = pgnActualizado;
    if (esFinal) {
      updateData.estado = 'COMPLETADO';
      updateData.fecha_completado = new Date().toISOString();
    }
  }

  const { error } = await supabaseAdmin
    .from('respuestas_alumnos')
    .update(updateData)
    .eq('ejercicio_id', ejercicioId)
    .eq('alumno_id', alumnoId);

  if (error) throw new Error(`Error al guardar movimiento: ${error.message}`);

  if (!esCorrecto) {
    await supabaseAdmin.rpc('incrementar_intentos_fallidos', {
      ej_id: ejercicioId,
      al_id: alumnoId,
    });
  }

  return true;
};

// GUARDAR COMENTARIO DEL ALUMNO

export const guardarComentarioAlumno = async (
  ejercicioId: string,
  alumnoId: string,
  comentario: string,
) => {
  const { data, error } = await supabaseAdmin
    .from('respuestas_alumnos')
    .update({ comentario_alumno: comentario })
    .eq('ejercicio_id', ejercicioId)
    .eq('alumno_id', alumnoId)
    .select()
    .single();

  if (error) throw new Error(`Error al guardar comentario: ${error.message}`);
  return data;
};

// OBTENER RESPUESTAS (PROFESOR)

export const obtenerRespuestasDeEjercicio = async (ejercicioId: string) => {
  const { data: respuestas, error } = await supabaseAdmin
    .from('respuestas_alumnos')
    .select('*')
    .eq('ejercicio_id', ejercicioId)
    .order('fecha_primer_acceso', { ascending: true, nullsFirst: false });

  if (error) throw new Error(`Error obteniendo respuestas: ${error.message}`);
  if (!respuestas || respuestas.length === 0) return [];

  const alumnoIds = [...new Set(respuestas.map(r => r.alumno_id))];
  const { data: usuarios } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, apellidos')
    .in('id', alumnoIds);

  const mapaUsuarios = Object.fromEntries(
    (usuarios ?? []).map(u => [u.id, { nombre: u.nombre, apellidos: u.apellidos }])
  );

  return respuestas.map(r => ({
    ...r,
    alumno: mapaUsuarios[r.alumno_id] ?? { nombre: 'Alumno', apellidos: 'desconocido' },
  }));
};

// EVALUAR RESPUESTA (PROFESOR)

export const evaluarRespuesta = async (
  respuestaId: string,
  evaluadorId: string,
  puntuacion: number,
  comentario?: string,
) => {
  const { data, error } = await supabaseAdmin
    .from('respuestas_alumnos')
    .update({
      puntuacion,
      comentario_revision: comentario || null,
      evaluador_id:        evaluadorId,
    })
    .eq('id', respuestaId)
    .select()
    .single();

  if (error) throw new Error(`Error al evaluar: ${error.message}`);
  return data;
};

// VERIFICAR Y ASIGNAR ALUMNOS

export const verificarYAsignarAlumnos = async (ejercicioId: string) => {
  const { data: config } = await supabaseAdmin
    .from('ejercicios')
    .select(`
      id,
      solucion_pgn,
      fecha_inicio,
      fecha_entrega,
      archivo:recursos_archivos(
        carpeta:recursos_carpetas(clase_id)
      )
    `)
    .eq('id', ejercicioId)
    .single();

  if (!config || !config.solucion_pgn || !config.fecha_inicio || !config.fecha_entrega) return false;

  const claseId = (config.archivo as any)?.carpeta?.clase_id;
  if (!claseId) return false;

  const { data: alumnos } = await supabaseAdmin
    .from('clase_alumnos')
    .select('alumno_id')
    .eq('clase_id', claseId);

  if (!alumnos || alumnos.length === 0) return false;

  const asignaciones = alumnos.map(a => ({
    ejercicio_id: config.id,
    alumno_id:    a.alumno_id,
    estado:       'NO_INICIADO',
  }));

  const { error } = await supabaseAdmin
    .from('respuestas_alumnos')
    .upsert(asignaciones, { onConflict: 'ejercicio_id, alumno_id', ignoreDuplicates: true });

  if (error) console.error('Error en auto-asignación:', error);
  return true;
};

// GUARDAR TIEMPO (ALUMNO)

export const guardarTiempoAlumno = async (
  ejercicioId: string,
  alumnoId: string,
  segundos: number,
) => {
  if (segundos <= 0) return;

  const { error } = await supabaseAdmin.rpc('sumar_tiempo_ejercicio', {
    ej_id:    ejercicioId,
    al_id:    alumnoId,
    segundos: segundos,
  });

  if (error) throw new Error(`Error al guardar tiempo: ${error.message}`);
  return true;
};