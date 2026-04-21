import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * True when the page is visible (tab/window) and, on native, the Capacitor app is active.
 * Use to gate audio so nothing plays while minimized or in background.
 */
export function useAppForeground(): boolean {
  const nativeActiveRef = useRef(true);
  const [foreground, setForeground] = useState(
    () => typeof document !== 'undefined' && !document.hidden
  );

  const sync = useCallback(() => {
    const tabVisible = typeof document !== 'undefined' && !document.hidden;
    const nativeOk = Capacitor.isNativePlatform() ? nativeActiveRef.current : true;
    setForeground(tabVisible && nativeOk);
  }, []);

  useEffect(() => {
    sync();
    document.addEventListener('visibilitychange', sync);

    let removeApp: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => {
        nativeActiveRef.current = isActive;
        sync();
      }).then((h) => {
        removeApp = () => h.remove();
      });
    }

    return () => {
      document.removeEventListener('visibilitychange', sync);
      removeApp?.();
    };
  }, [sync]);

  return foreground;
}
