import { contextBridge, ipcRenderer } from 'electron';

const overlayAPI = {
  /** Request activation of selection mode (Phase 3 implements handler) */
  activateSelection: (): Promise<void> =>
    ipcRenderer.invoke('overlay:activate-selection'),

  /** Listen for overlay mode changes from main process */
  onModeChange: (callback: (mode: 'inactive' | 'selection') => void): void => {
    ipcRenderer.on('overlay:mode-change', (_event, mode) => callback(mode));
  },
};

contextBridge.exposeInMainWorld('claw', overlayAPI);

/** Exported type for use in type declarations */
export type ClawOverlayAPI = typeof overlayAPI;
