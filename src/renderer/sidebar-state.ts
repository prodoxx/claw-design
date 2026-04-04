// Sidebar state machine (pure functions -- no DOM dependency)
// Exported for testing, consumed by sidebar.ts renderer

export type SidebarVisualState = 'hidden' | 'minimized' | 'expanded';

export interface SidebarState {
  visual: SidebarVisualState;
  tasks: Map<string, TaskUpdate>;
  autoExpandTimerId: number | null;
  selectionModeActive: boolean;
}

export interface TaskUpdate {
  id: string;
  instruction: string;
  status: 'queued' | 'sending' | 'editing' | 'done' | 'error';
  error?: string;
}

export type SidebarEvent =
  | { type: 'TASK_ADDED'; task: TaskUpdate }
  | { type: 'TASK_UPDATED'; task: TaskUpdate }
  | { type: 'TASK_DISMISSED'; id: string }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'SELECTION_MODE_ACTIVE' }
  | { type: 'SELECTION_MODE_INACTIVE' }
  | { type: 'AUTO_EXPAND_TIMEOUT' };

export const INITIAL_SIDEBAR_STATE: SidebarState = {
  visual: 'hidden',
  tasks: new Map(),
  autoExpandTimerId: null,
  selectionModeActive: false,
};

/**
 * Compute badge counter: "{completed}/{total}"
 * Completed = done + error status tasks
 */
export function computeBadge(tasks: Map<string, TaskUpdate>): {
  completed: number;
  total: number;
  text: string;
} {
  let completed = 0;
  let total = 0;
  for (const task of tasks.values()) {
    total++;
    if (task.status === 'done' || task.status === 'error') {
      completed++;
    }
  }
  return { completed, total, text: `${completed}/${total}` };
}

/**
 * Pure state transition for the sidebar visual state.
 * Returns a new state object (does not mutate input).
 *
 * Note: autoExpandTimerId is managed by the renderer (timer side effects
 * cannot live in a pure function). The state machine tracks intent via
 * the `shouldAutoExpand` flag in the return value.
 */
export interface TransitionResult {
  state: SidebarState;
  shouldAutoExpand: boolean;
  shouldPulse: 'done' | 'error' | null;
}

export function sidebarTransition(
  state: SidebarState,
  event: SidebarEvent,
): TransitionResult {
  const noEffect = { shouldAutoExpand: false, shouldPulse: null } as const;

  switch (event.type) {
    case 'TASK_ADDED': {
      const newTasks = new Map(state.tasks);
      newTasks.set(event.task.id, event.task);

      if (state.visual === 'hidden') {
        // First task submitted: hidden -> minimized, trigger auto-expand
        return {
          state: { ...state, visual: 'minimized', tasks: newTasks },
          shouldAutoExpand: true,
          shouldPulse: null,
        };
      }

      if (state.visual === 'minimized') {
        // New task while minimized: trigger auto-expand (D-06)
        return {
          state: { ...state, tasks: newTasks },
          shouldAutoExpand: true,
          shouldPulse: null,
        };
      }

      // Expanded: just add the task
      return {
        state: { ...state, tasks: newTasks },
        ...noEffect,
      };
    }

    case 'TASK_UPDATED': {
      const newTasks = new Map(state.tasks);
      newTasks.set(event.task.id, event.task);

      // Check if task completed/errored while minimized -> pulse badge
      const isTerminal =
        event.task.status === 'done' || event.task.status === 'error';
      const pulse =
        isTerminal && state.visual === 'minimized'
          ? event.task.status === 'error'
            ? ('error' as const)
            : ('done' as const)
          : null;

      return {
        state: { ...state, tasks: newTasks },
        shouldAutoExpand: false,
        shouldPulse: pulse,
      };
    }

    case 'TASK_DISMISSED': {
      const newTasks = new Map(state.tasks);
      newTasks.delete(event.id);

      // If no tasks remain, transition to hidden
      if (newTasks.size === 0) {
        return {
          state: { ...state, visual: 'hidden', tasks: newTasks },
          ...noEffect,
        };
      }

      return {
        state: { ...state, tasks: newTasks },
        ...noEffect,
      };
    }

    case 'EXPAND': {
      if (state.visual === 'minimized') {
        return {
          state: { ...state, visual: 'expanded' },
          ...noEffect,
        };
      }
      return { state, ...noEffect };
    }

    case 'COLLAPSE': {
      if (state.visual === 'expanded') {
        return {
          state: { ...state, visual: 'minimized' },
          ...noEffect,
        };
      }
      return { state, ...noEffect };
    }

    case 'SELECTION_MODE_ACTIVE': {
      // D-08: auto-minimize when selection mode activates
      if (state.visual === 'expanded') {
        return {
          state: {
            ...state,
            visual: 'minimized',
            selectionModeActive: true,
          },
          ...noEffect,
        };
      }
      return {
        state: { ...state, selectionModeActive: true },
        ...noEffect,
      };
    }

    case 'SELECTION_MODE_INACTIVE': {
      return {
        state: { ...state, selectionModeActive: false },
        ...noEffect,
      };
    }

    case 'AUTO_EXPAND_TIMEOUT': {
      // Auto-expand timer expired: collapse back to minimized
      if (state.visual === 'expanded') {
        return {
          state: { ...state, visual: 'minimized' },
          ...noEffect,
        };
      }
      return { state, ...noEffect };
    }

    default:
      return { state, ...noEffect };
  }
}
