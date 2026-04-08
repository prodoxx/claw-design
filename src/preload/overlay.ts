import { contextBridge, ipcRenderer } from 'electron';

/** Plain object describing element bounds (not DOMRect -- must be IPC-serializable) */
export interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const overlayAPI = {
  /** Request activation of selection mode (expand overlay to full window).
   *  Returns the overlay view's pre-expansion bounds so the renderer can
   *  translate view-local toolbar coordinates into full-window coordinates. */
  activateSelection: (): Promise<{ x: number; y: number; width: number; height: number }> =>
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

  /** Submit instruction with screenshot + DOM context to main process */
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
    referenceImages?: Buffer[];
    model?: string;
  }): Promise<void> =>
    ipcRenderer.invoke('overlay:submit-instruction', data),

  /** Listen for instruction prefill events (retry flow -- D-19) */
  onPrefillInstruction: (callback: (data: { instruction: string }) => void): void => {
    ipcRenderer.on('overlay:prefill-instruction', (_event, data) => callback(data));
  },

  /** Apply a drag delta to the toolbar position (returns new position) */
  dragToolbar: (dx: number, dy: number): Promise<{ x: number; y: number }> =>
    ipcRenderer.invoke('overlay:drag-toolbar', { dx, dy }),

  /** Set absolute toolbar position (used to restore saved position) */
  setToolbarPosition: (x: number, y: number): Promise<void> =>
    ipcRenderer.invoke('overlay:set-toolbar-position', { x, y }),

  /** Switch viewport preset (ELEC-03) */
  setViewport: (preset: string): Promise<void> =>
    ipcRenderer.invoke('viewport:set', { preset }),

  /** Listen for viewport changes from main process (sync active state) */
  onViewportChanged: (callback: (data: { preset: string }) => void): void => {
    ipcRenderer.on('viewport:changed', (_event, data) => callback(data));
  },

  /** Listen for toast show events from main process (D-08, D-09) */
  onToastShow: (callback: (data: {
    id: string;
    severity: 'info' | 'warning' | 'error';
    title?: string;
    message: string;
    persistent: boolean;
  }) => void): void => {
    ipcRenderer.on('toast:show', (_event, data) => callback(data));
  },

  /** Listen for toast dismiss events from main process */
  onToastDismiss: (callback: (data: { id: string }) => void): void => {
    ipcRenderer.on('toast:dismiss', (_event, data) => callback(data));
  },

  /** Listen for site load complete event from main process */
  onSiteLoaded: (callback: () => void): void => {
    ipcRenderer.on('site:loaded', () => callback());
  },
};

contextBridge.exposeInMainWorld('claw', overlayAPI);

/** Exported type for use in type declarations */
export type ClawOverlayAPI = typeof overlayAPI;
