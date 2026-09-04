import { useState, useCallback, useEffect } from 'react';

export function useDirtyState(initialDirty: boolean = false) {
  const [isDirty, setIsDirty] = useState<boolean>(initialDirty);

  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  // Sync dirty state with Electron main process for window close interception
  useEffect(() => {
    if ((window as any).nvlDesktop?.setDirty) {
      (window as any).nvlDesktop.setDirty(isDirty).catch(() => {});
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  // Listen to dirty state updates from main process
  useEffect(() => {
    if ((window as any).nvlDesktop?.onProjectDirty) {
      const unsubscribe = (window as any).nvlDesktop.onProjectDirty((dirty: boolean) => {
        setIsDirty(dirty);
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, []);

  return {
    isDirty,
    markDirty,
    markClean,
  };
}
