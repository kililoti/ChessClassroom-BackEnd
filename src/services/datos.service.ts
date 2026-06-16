import { supabaseAdmin } from '../config/supabase';

// ════════════════════════════════════════════════════════════
// ALUMNOS DE CLASE
// ════════════════════════════════════════════════════════════

export const obtenerAlumnosDeClase = async (claseId: string) => {
  const { data, error } = await supabaseAdmin
    .from('clase_alumnos')
    .select('alumno_id, alias, usuarios!clase_alumnos_alumno_id_fkey(id, nombre, apellidos)')
    .eq('clase_id', claseId);

  if (error) throw new Error(error.message);
  return data;
};

// ════════════════════════════════════════════════════════════
// EJERCICIOS — Rendimiento por categoría
// ════════════════════════════════════════════════════════════

const CATEGORIAS_EJERCICIOS = ['tactica', 'calculo', 'apertura', 'estrategia', 'final'];

export const obtenerRendimientoEjercicios = async (alumnoId: string, claseId: string) => {
  const { data: carpetas, error: errCarpetas } = await supabaseAdmin
    .from('recursos_carpetas')
    .select('id')
    .eq('clase_id', claseId)
    .eq('modulo', 'ejercicio');

  if (errCarpetas) throw new Error(errCarpetas.message);
  if (!carpetas || carpetas.length === 0) {
    return { global: vacioGlobal(), porCategoria: [], progresionPorCategoria: {} };
  }

  const carpetaIds = carpetas.map(c => c.id);

  const { data: stats, error: errStats } = await supabaseAdmin
    .from('respuestas_alumnos')
    .select(`
      estado,
      tiempo_acumulado,
      intentos_fallidos,
      puntuacion,
      fecha_completado,
      ejercicios!respuestas_alumnos_ejercicio_id_fkey(
        archivo_id,
        recursos_archivos!ejercicios_archivo_id_fkey(categoria, carpeta_id)
      )
    `)
    .eq('alumno_id', alumnoId);

  if (errStats) throw new Error(errStats.message);

  const filtradas = (stats ?? []).filter((ra: any) => {
    const carpetaId = ra.ejercicios?.recursos_archivos?.carpeta_id;
    return carpetaIds.includes(carpetaId);
  });

  // ── Resumen global (todas las categorías, sin partida) ──
  const globalItems = filtradas.filter((ra: any) =>
    CATEGORIAS_EJERCICIOS.includes(ra.ejercicios?.recursos_archivos?.categoria)
  );
  const global = calcularResumenCategoria(globalItems);

  // ── Por categoría ──
  const porCategoria = CATEGORIAS_EJERCICIOS.map(cat => {
    const items = filtradas.filter((ra: any) =>
      ra.ejercicios?.recursos_archivos?.categoria === cat
    );
    return { categoria: cat, ...calcularResumenCategoria(items) };
  });

  // ── Progresión temporal por categoría ──
  const progresionPorCategoria: Record<string, any[]> = {};
  CATEGORIAS_EJERCICIOS.forEach(cat => {
    const items = filtradas.filter((ra: any) =>
      ra.ejercicios?.recursos_archivos?.categoria === cat && ra.fecha_completado
    );
    progresionPorCategoria[cat] = construirProgresion(items);
  });

  return { global, porCategoria, progresionPorCategoria };
};

function vacioGlobal() {
  return {
    total: 0, completados: 0, enProgreso: 0, noIniciados: 0,
    tasaExito: 0, tiempoMedio: 0, erroresMedio: 0, puntuacionMedia: null,
  };
}

function calcularResumenCategoria(items: any[]) {
  const completados = items.filter((ra: any) => ra.estado === 'COMPLETADO');
  const tiempos = completados.map((ra: any) => ra.tiempo_acumulado ?? 0).filter((t: number) => t > 0);
  // Puntuación: solo de respuestas que realmente tienen puntuacion (no null/undefined)
  const puntuaciones = items
    .map((ra: any) => ra.puntuacion)
    .filter((p: any) => p !== null && p !== undefined);
  // Errores: media de intentos_fallidos sobre TODOS los items (asignados), no solo completados
  const erroresTotal = items.reduce((sum: number, ra: any) => sum + (ra.intentos_fallidos ?? 0), 0);

  return {
    total: items.length,
    completados: completados.length,
    enProgreso: items.filter((ra: any) => ra.estado === 'EN_PROGRESO').length,
    noIniciados: items.filter((ra: any) => ra.estado === 'NO_INICIADO').length,
    tasaExito: items.length > 0 ? Math.round((completados.length / items.length) * 100) : 0,
    // Tiempo medio = media del tiempo_acumulado SOLO de los completados (cada uno es un ejercicio distinto)
    tiempoMedio: tiempos.length > 0
      ? Math.round(tiempos.reduce((a: number, b: number) => a + b, 0) / tiempos.length)
      : 0,
    erroresMedio: items.length > 0
      ? Math.round((erroresTotal / items.length) * 10) / 10
      : 0,
    puntuacionMedia: puntuaciones.length > 0
      ? Math.round((puntuaciones.reduce((a: number, b: number) => a + b, 0) / puntuaciones.length) * 10) / 10
      : null,
  };
}

function construirProgresion(items: any[]) {
  // Ordenar por fecha_completado ascendente y devolver un punto por ejercicio completado
  const ordenados = [...items].sort((a, b) =>
    new Date(a.fecha_completado).getTime() - new Date(b.fecha_completado).getTime()
  );

  return ordenados.map((ra: any, i: number) => ({
    indice: i + 1,
    fecha: ra.fecha_completado,
    fechaLabel: formatFechaCorta(ra.fecha_completado),
    tiempo: ra.tiempo_acumulado ?? 0,
    errores: ra.intentos_fallidos ?? 0,
    acierto: ra.estado === 'COMPLETADO' ? 100 : 0,
  }));
}

function formatFechaCorta(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ════════════════════════════════════════════════════════════
// PARTIDAS — Rendimiento en partidas (individuales + torneo)
// ════════════════════════════════════════════════════════════

type RitmoPartida = 'bullet' | 'blitz' | 'rapida';

function clasificarRitmo(tiempoMs: number): RitmoPartida {
  if (tiempoMs < 180_000) return 'bullet';
  if (tiempoMs < 600_000) return 'blitz';
  return 'rapida';
}

function resultadoParaAlumno(resultado: string | null, esBlancas: boolean): 'gana' | 'pierde' | 'tablas' | null {
  if (!resultado) return null;
  if (resultado === '1/2-1/2') return 'tablas';
  if (resultado === '1-0') return esBlancas ? 'gana' : 'pierde';
  if (resultado === '0-1') return esBlancas ? 'pierde' : 'gana';
  return null;
}

export const obtenerRendimientoPartidas = async (alumnoId: string, claseId: string) => {
  const { data: partidas, error } = await supabaseAdmin
    .from('partidas')
    .select('id, clase_id, jugador_blancas_id, jugador_negras_id, torneo_id, resultado, tiempo_blancas_ms, estado, finalizada_at, creado_en')
    .eq('clase_id', claseId)
    .or(`jugador_blancas_id.eq.${alumnoId},jugador_negras_id.eq.${alumnoId}`)
    .eq('estado', 'finalizada');

  if (error) throw new Error(error.message);

  const procesadas = (partidas ?? []).map((p: any) => {
    const esBlancas = p.jugador_blancas_id === alumnoId;
    const res = resultadoParaAlumno(p.resultado, esBlancas);
    const ritmo = clasificarRitmo(p.tiempo_blancas_ms ?? 600_000);
    return {
      ...p,
      esBlancas,
      resultadoAlumno: res,
      ritmo,
      esTorneo: !!p.torneo_id,
    };
  });

  return {
    global: calcularResumenPartidas(procesadas),
    porRitmo: {
      bullet: calcularResumenPartidas(procesadas.filter((p: any) => p.ritmo === 'bullet')),
      blitz: calcularResumenPartidas(procesadas.filter((p: any) => p.ritmo === 'blitz')),
      rapida: calcularResumenPartidas(procesadas.filter((p: any) => p.ritmo === 'rapida')),
    },
    porColor: {
      blancas: calcularResumenPartidas(procesadas.filter((p: any) => p.esBlancas)),
      negras: calcularResumenPartidas(procesadas.filter((p: any) => !p.esBlancas)),
    },
    porTipo: {
      torneo: calcularResumenPartidas(procesadas.filter((p: any) => p.esTorneo)),
      individual: calcularResumenPartidas(procesadas.filter((p: any) => !p.esTorneo)),
    },
  };
};

function calcularResumenPartidas(partidas: any[]) {
  const total = partidas.length;
  const ganadas = partidas.filter(p => p.resultadoAlumno === 'gana').length;
  const perdidas = partidas.filter(p => p.resultadoAlumno === 'pierde').length;
  const tablas = partidas.filter(p => p.resultadoAlumno === 'tablas').length;

  return {
    total,
    ganadas,
    perdidas,
    tablas,
    porcentajeVictoria: total > 0 ? Math.round((ganadas / total) * 100) : 0,
    porcentajeTablas: total > 0 ? Math.round((tablas / total) * 100) : 0,
    porcentajeDerrota: total > 0 ? Math.round((perdidas / total) * 100) : 0,
  };
}