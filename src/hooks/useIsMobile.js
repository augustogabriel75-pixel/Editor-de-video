import { useSyncExternalStore } from 'react';

/** Layout móvel (celulares e tablets em retrato). */
const MOBILE_QUERY = '(max-width: 940px)';
const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

const subscribe = (cb) => {
  mq?.addEventListener?.('change', cb);
  return () => mq?.removeEventListener?.('change', cb);
};

export function useIsMobile() {
  return useSyncExternalStore(subscribe, () => !!mq?.matches, () => false);
}

export const isTouchDevice = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none)').matches;
