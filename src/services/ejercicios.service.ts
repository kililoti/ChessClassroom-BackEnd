import { supabaseAdmin } from '../config/supabase';
import * as recursosService from './recursos.service';

// CREAR EJERCICIO (PROFESOR)

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
  // Subir el archivo base
  const archivoBase = await recursosService.procesarYSubirPGN(
    archivoBuffer, nombreOriginal, mimeType,
    carpetaId, profesorId, categoria,
    nombrePersonalizado, visible,
    'ejercicio'
  );

  // Crear la configuración
  const { data: ejercicio, error } = await supabaseAdmin
    .from('ejercicios')
    .insert({
      archivo_id:           archivoBase.id,
      fecha_inicio:         fechaInicio || null,
      fecha_entrega:        fechaEntrega || null,
      solucion_pgn:         solucionPgn || null,
      comentarios_solucion: comentariosSolucion || null,
      asignado:             false,
    })
    .select()
    .single();

  if (error) throw new Error(`Error al crear configuración del ejercicio: ${error.message}`);
  return { ...archivoBase, ejercicio_config: ejercicio };
};

// OBTENER EJERCICIO COMPLETO
export const obtenerEjercicio = async (archivoId: string, esProfesor: boolean) => {
  const { data: archivo, error: errorArchivo } = await supabaseAdmin
    .from('recursos_archivos')
    .select(`*, usuarios (nombre, apellidos)`)
    .eq('id', archivoId)
    .eq('tipo_recurso', 'ejercicio')
    .single();

  if (errorArchivo || !archivo) throw new Error('Ejercicio no encontrado.');
  if (!esProfesor && !archivo.visible) throw new Error('No tienes permiso para acceder a este ejercicio.');

  const { data: config, error: errorConfig } = await supabaseAdmin
    .from('ejercicios')
    .select('*')
    .eq('archivo_id', archivoId)
    .single();

  if (errorConfig || !config) throw new Error('Configuración del ejercicio no encontrada.');

  return { ...archivo, ejercicio_config: config };
};

// ACTUALIZAR SOLUCIÓN (PROFESOR)

export const actualizarSolucion = async (
  archivoId: string,
  solucionPgn: string,
  comentariosSolucion?: string,
) => {
  // Buscar el ejercicio por archivo_id
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

  // No se puede asignar sin solución
  if (asignado && !ejercicio.solucion_pgn) {
    throw new Error('No se puede asignar un ejercicio sin solución definida.');
  }

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
  // Si ya existe un intento, devolver el existente (no reiniciar el timer)
  const { data: existente } = await supabaseAdmin
    .from('respuestas_alumnos')
    .select('*')
    .eq('ejercicio_id', ejercicioId)
    .eq('alumno_id', alumnoId)
    .single();

  if (existente) return existente;

  // Primera vez, arrancar el timer
  const { data: nuevo, error } = await supabaseAdmin
    .from('respuestas_alumnos')
    .insert({
      ejercicio_id:       ejercicioId,
      alumno_id:          alumnoId,
      estado:             'EN_PROGRESO',
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

  // Si no existe todavía, devolver null (aún no ha iniciado)
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

  // OBTENER LA FECHA DE ENTREGA DEL EJERCICIO
  const { data: ejercicio, error: errEj } = await supabaseAdmin
    .from('ejercicios')
    .select('fecha_entrega')
    .eq('id', ejercicioId)
    .single();

  if (errEj) throw new Error(`Error al verificar ejercicio: ${errEj.message}`);

  // VERIFICAR SI HA VENCIDO
  if (ejercicio?.fecha_entrega) {
    const vencimiento = new Date(ejercicio.fecha_entrega);
    const ahora = new Date();
    if (ahora > vencimiento) {
      throw new Error('EJERCICIO_VENCIDO');
    }
  }

  // CONTINUAR CON EL GUARDADO ORIGINAL
  const updateData: Record<string, any> = {
    pgn_ultimo_movimiento: pgnActualizado,
  };

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

  // VERIFICAR SI HA VENCIDO
  const { data: ejercicio } = await supabaseAdmin
    .from('ejercicios')
    .select('fecha_entrega')
    .eq('id', ejercicioId)
    .single();

  if (ejercicio?.fecha_entrega && new Date() > new Date(ejercicio.fecha_entrega)) {
    throw new Error('EJERCICIO_VENCIDO');
  }

  // CONTINUAR CON EL GUARDADO ORIGINAL
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
  const { data, error } = await supabaseAdmin
    .from('respuestas_alumnos')
    .select(`
      *,
      alumno:usuarios!alumno_id(nombre, apellidos)
    `)
    .eq('ejercicio_id', ejercicioId)
    .order('fecha_primer_acceso', { ascending: true, nullsFirst: false });

  if (error) throw new Error(`Error obteniendo respuestas: ${error.message}`);
  return data;
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

export const verificarYAsignarAlumnos = async (archivoId: string) => {
  // Obtener el ejercicio, fecha, solución y el ID de la clase a la que pertenece
  const { data: config } = await supabaseAdmin
    .from('ejercicios')
    .select(`
      id,
      solucion_pgn,
      fecha_entrega,
      archivo:recursos_archivos(
        carpeta:recursos_carpetas(clase_id)
      )
    `)
    .eq('archivo_id', archivoId)
    .single();

  // Tiene fecha Y tiene solución? Si falta una, no hace nada.
  if (!config || !config.solucion_pgn || !config.fecha_entrega) return false;

  const claseId = (config.archivo as any)?.carpeta?.clase_id;
  if (!claseId) return false;

  // Obtiene todos los alumnos inscritos en esa clase
  const { data: alumnos } = await supabaseAdmin
    .from('clase_alumnos')
    .select('alumno_id')
    .eq('clase_id', claseId);

  if (!alumnos || alumnos.length === 0) return false;

  // Preparar el array de asignaciones con estado inicial
  const asignaciones = alumnos.map(a => ({
    ejercicio_id: config.id, // Usar el ID interno del ejercicio
    alumno_id: a.alumno_id,
    estado: 'NO_INICIADO'
  }));

  // Insertar a los alumnos
  // 'ignoreDuplicates: true' asegura que si un alumno ya estaba asignado, no lo duplica ni resetea su progreso.
  const { error } = await supabaseAdmin
    .from('respuestas_alumnos')
    .upsert(asignaciones, { onConflict: 'ejercicio_id, alumno_id', ignoreDuplicates: true });

  if (error) console.error("Error en auto-asignación:", error);
  return true;
};