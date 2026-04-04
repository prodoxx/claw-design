import { contextBridge, ipcRenderer } from 'electron';

const sidebarAPI = {
  /** Listen for task status updates from main process */
  onTaskUpdate: (
    callback: (data: {
      id: string;
      instruction: string;
      status: string;
      error?: string;
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
};

contextBridge.exposeInMainWorld('clawSidebar', sidebarAPI);

/** Exported type for use in type declarations */
export type ClawSidebarAPI = typeof sidebarAPI;
