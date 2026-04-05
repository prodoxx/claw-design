import { contextBridge, ipcRenderer } from 'electron';

const sidebarAPI = {
  /** Listen for task status updates from main process */
  onTaskUpdate: (
    callback: (data: {
      id: string;
      instruction: string;
      status: string;
      error?: string;
      activity?: string;
    }) => void,
  ): void => {
    ipcRenderer.on('sidebar:task-update', (_event, data) => callback(data));
  },

  /** Request sidebar expand (main process adjusts view bounds) */
  expand: (): Promise<void> => ipcRenderer.invoke('sidebar:expand'),

  /** Request sidebar collapse (main process restores view bounds) */
  collapse: (): Promise<void> => ipcRenderer.invoke('sidebar:collapse'),

  /** Dismiss a completed or errored task */
  dismissTask: (id: string): Promise<void> =>
    ipcRenderer.invoke('sidebar:task-dismiss', { id }),

  /** Retry an errored task */
  retryTask: (id: string): Promise<void> =>
    ipcRenderer.invoke('sidebar:task-retry', { id }),

  /** Undo a completed task (asks Claude to revert the change) */
  undoTask: (id: string): Promise<void> =>
    ipcRenderer.invoke('sidebar:task-undo', { id }),

  /** Listen for sidebar state changes from main process (e.g. D-08 auto-minimize) */
  onStateChange: (callback: (state: 'hidden' | 'minimized' | 'expanded') => void): void => {
    ipcRenderer.on('sidebar:state-change', (_event, state) => callback(state));
  },

  /** Get logs for a specific task */
  getTaskLogs: (id: string): Promise<Array<{ timestamp: number; type: string; content: string }>> =>
    ipcRenderer.invoke('sidebar:task-logs', { id }),

  /** Apply a drag delta to the sidebar position (returns new position) */
  dragDelta: (dx: number, dy: number): Promise<{ x: number; y: number }> =>
    ipcRenderer.invoke('sidebar:drag-delta', { dx, dy }),

  /** Set absolute sidebar position (used to restore saved position) */
  setPosition: (x: number, y: number): Promise<void> =>
    ipcRenderer.invoke('sidebar:set-position', { x, y }),
};

contextBridge.exposeInMainWorld('clawSidebar', sidebarAPI);

/** Exported type for use in type declarations */
export type ClawSidebarAPI = typeof sidebarAPI;
