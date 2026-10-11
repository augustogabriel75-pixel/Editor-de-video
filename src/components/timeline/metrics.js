import { useIsMobile } from '../../hooks/useIsMobile';
import { HEADER_W } from './constants';

/** Medidas da timeline conforme o layout (desktop ou celular). */
export function useTimelineMetrics() {
  const compact = useIsMobile();
  return { compact, headerW: compact ? 100 : HEADER_W, trackScale: compact ? 0.8 : 1 };
}
