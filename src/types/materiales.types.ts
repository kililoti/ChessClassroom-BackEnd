export type TipoMaterial = 'foto' | 'video' | 'youtube';

export interface Material {
  id: string;
  nombre: string;
  carpeta_id: string;
  profesor_id: string;
  tipo: TipoMaterial;

  // Foto / vídeo subidos
  storage_path: string | null;
  tamanio: number | null;

  // YouTube
  youtube_url: string | null;
  youtube_id: string | null;

  // Miniatura
  miniatura_path: string | null;
  miniatura_url: string | null;

  visible: boolean;
  created_at: string;
  usuarios?: { nombre: string; apellidos: string };
}

export function formatTamanio(bytes: number | null): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

export function formatFechaMaterial(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export const ICONOS_TIPO: Record<TipoMaterial, string> = {
  foto: '🖼️',
  video: '🎬',
  youtube: '▶️',
};

export const ETIQUETAS_TIPO: Record<TipoMaterial, string> = {
  foto: 'Foto',
  video: 'Vídeo',
  youtube: 'YouTube',
};