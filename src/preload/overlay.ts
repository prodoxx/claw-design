import { contextBridge, ipcRenderer } from 'electron';

/** Plain object describing element bounds (not DOMRect -- must be IPC-serializable) */
export interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const overlayAPI = {
  /** Request activation of selection mode (expand overlay to full window) */
  activateSelection: (): Promise<void> =>
    ipcRenderer.invoke('overlay:activate-selection'),

  /** Request deactivation of selection mode (shrink overlay to toolbar area) */
  deactivateSelection: (): Promise<void> =>
    ipcRenderer.invoke('overlay:deactivate-selection'),

  /** Listen for overlay mode changes from main process */
  onModeChange: (callback: (mode: 'inactive' | 'selection') => void): void => {
    ipcRenderer.on('overlay:mode-change', (_event, mode) => callback(mode));
  },

  /** Query the site view for the element at the given CSS-pixel coordinates */
  getElementAtPoint: (x: number, y: number): Promise<SelectionBounds | null> =>
    ipcRenderer.invoke('overlay:get-element-at-point', x, y),

  /** Listen for selection committed events (Phase 4 uses this to trigger capture) */
  onSelectionCommitted: (callback: (bounds: SelectionBounds) => void): void => {
    ipcRenderer.on('overlay:selection-committed', (_event, bounds) =>
      callback(bounds),
    );
  },

  /** Capture screenshot of selected region as PNG buffer (Plan 03-02) */
  captureScreenshot: (bounds: { x: number; y: number; width: number; height: number }): Promise<Buffer> =>
    ipcRenderer.invoke('overlay:capture-screenshot', bounds),

  /** Extract DOM elements within selected region (Plan 03-02) */
  extractDom: (bounds: { x: number; y: number; width: number; height: number }): Promise<{
    elements: Array<{
      tag: string;
      id?: string;
      classes: string[];
      text?: string;
      bounds: { x: number; y: number; width: number; height: number };
      path: string;
    }>;
    viewport: { width: number; height: number };
  }> =>
    ipcRenderer.invoke('overlay:extract-dom', bounds),

  /** Submit instruction with screenshot + DOM context to main process (Plan 03-03) */
  submitInstruction: (data: {
    instruction: string;
    screenshot: Buffer;
    dom: {
      elements: Array<{
        tag: string;
        id?: string;
        classes: string[];
        text?: string;
        bounds: { x: number; y: number; width: number; height: number };
        path: string;
      }>;
      viewport: { width: number; height: number };
    };
    bounds: { x: number; y: number; width: number; height: number };
  }): Promise<void> =>
    ipcRenderer.invoke('overlay:submit-instruction', data),
};

contextBridge.exposeInMainWorld('claw', overlayAPI);

/** Exported type for use in type declarations */
export type ClawOverlayAPI = typeof overlayAPI;
