/**
 * Tipos de mídia aceitos na importação.
 *
 * Alguns sistemas entregam arquivos .mov do iPhone (QuickTime) sem tipo ou como "video/quicktime".
 * O Firefox e alguns WebViews recusam tocar um blob "video/quicktime", embora o contêiner seja
 * o mesmo do MP4 (ISO BMFF). Por isso o blob de reprodução é reetiquetado como video/mp4.
 */
const VIDEO_EXT = ['mp4', 'm4v', 'mov', 'qt', 'webm', 'mkv', '3gp', '3g2', 'ogv', 'avi', 'hevc'];
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'svg'];
const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'weba', 'caf', 'aif', 'aiff', 'amr'];

/** Valor do atributo accept dos seletores de arquivo. */
export const IMPORT_ACCEPT = ['video/*', 'image/*', 'audio/*', 'video/quicktime', ...[...VIDEO_EXT, ...AUDIO_EXT].map((e) => `.${e}`)].join(',');

export const extOf = (name = '') => (/\.([^.]+)$/.exec(name)?.[1] || '').toLowerCase();

/** 'video' | 'image' | 'audio' | null */
export function mediaKind(file) {
  const t = (file?.type || '').toLowerCase();
  const ext = extOf(file?.name);
  if (t.startsWith('video/') || VIDEO_EXT.includes(ext)) return 'video';
  if (t.startsWith('image/') || IMAGE_EXT.includes(ext)) return 'image';
  if (t.startsWith('audio/') || AUDIO_EXT.includes(ext)) return 'audio';
  return null;
}

const isQuickTime = (blob, name) => /quicktime/i.test(blob?.type || '') || ['mov', 'qt'].includes(extOf(name)) || (!blob?.type && extOf(name) === 'm4v');

/** URL de reprodução para um arquivo de mídia (reetiqueta QuickTime/.mov como MP4). */
export function playableUrl(blob, name = blob?.name) {
  if (isQuickTime(blob, name)) return URL.createObjectURL(new Blob([blob], { type: 'video/mp4' }));
  return URL.createObjectURL(blob);
}
