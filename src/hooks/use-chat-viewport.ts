'use client';
import { useEffect, useRef } from 'react';

/** Follow the visible viewport, including Safari's keyboard pan, rather than layout height. */
export function useChatViewport() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;
    let baseline = viewport?.height || window.innerHeight;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = viewport?.height || window.innerHeight;
        baseline = Math.max(baseline, height);
        const focused = ref.current?.contains(document.activeElement) && document.activeElement?.tagName === 'TEXTAREA';
        const keyboard = baseline - height > 120 && (viewport?.scale ?? 1) === 1;
        root.toggleAttribute('data-chat-input-active', Boolean(focused || keyboard));
        ref.current?.style.setProperty('--chat-height', height + 'px');
        ref.current?.style.setProperty('--chat-top', (viewport?.offsetTop || 0) + 'px');
      });
    };
    const rotate = () => { baseline = viewport?.height || window.innerHeight; update(); };
    update();
    viewport?.addEventListener('resize', update); viewport?.addEventListener('scroll', update);
    document.addEventListener('focusin', update); document.addEventListener('focusout', update);
    window.addEventListener('resize', update); window.addEventListener('orientationchange', rotate);
    return () => {
      cancelAnimationFrame(frame); root.removeAttribute('data-chat-input-active');
      viewport?.removeEventListener('resize', update); viewport?.removeEventListener('scroll', update);
      document.removeEventListener('focusin', update); document.removeEventListener('focusout', update);
      window.removeEventListener('resize', update); window.removeEventListener('orientationchange', rotate);
    };
  }, []);
  return ref;
}
