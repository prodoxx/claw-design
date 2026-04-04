import { describe, it, expect } from 'vitest';
import {
  sidebarTransition,
  computeBadge,
  INITIAL_SIDEBAR_STATE,
  type SidebarState,
  type TaskUpdate,
} from '../../src/renderer/sidebar-state.js';

function makeTask(overrides: Partial<TaskUpdate> = {}): TaskUpdate {
  return {
    id: 'task-1',
    instruction: 'Make the header red',
    status: 'queued',
    ...overrides,
  };
}

function stateWithTasks(
  visual: SidebarState['visual'],
  tasks: TaskUpdate[],
): SidebarState {
  const map = new Map<string, TaskUpdate>();
  for (const t of tasks) map.set(t.id, t);
  return {
    ...INITIAL_SIDEBAR_STATE,
    visual,
    tasks: map,
  };
}

describe('sidebar state machine', () => {
  it('initial state is hidden', () => {
    expect(INITIAL_SIDEBAR_STATE.visual).toBe('hidden');
    expect(INITIAL_SIDEBAR_STATE.tasks.size).toBe(0);
  });

  it('first task submitted transitions hidden -> minimized with auto-expand flag', () => {
    const task = makeTask();
    const result = sidebarTransition(INITIAL_SIDEBAR_STATE, {
      type: 'TASK_ADDED',
      task,
    });
    expect(result.state.visual).toBe('minimized');
    expect(result.shouldAutoExpand).toBe(true);
    expect(result.state.tasks.has('task-1')).toBe(true);
  });

  it('click expand transitions minimized -> expanded', () => {
    const state = stateWithTasks('minimized', [makeTask()]);
    const result = sidebarTransition(state, { type: 'EXPAND' });
    expect(result.state.visual).toBe('expanded');
  });

  it('click minimize transitions expanded -> minimized', () => {
    const state = stateWithTasks('expanded', [makeTask()]);
    const result = sidebarTransition(state, { type: 'COLLAPSE' });
    expect(result.state.visual).toBe('minimized');
  });

  it('all tasks dismissed transitions to hidden', () => {
    const state = stateWithTasks('minimized', [makeTask({ id: 'task-1' })]);
    const result = sidebarTransition(state, {
      type: 'TASK_DISMISSED',
      id: 'task-1',
    });
    expect(result.state.visual).toBe('hidden');
    expect(result.state.tasks.size).toBe(0);
  });

  it('selection mode active transitions expanded -> minimized', () => {
    const state = stateWithTasks('expanded', [makeTask()]);
    const result = sidebarTransition(state, {
      type: 'SELECTION_MODE_ACTIVE',
    });
    expect(result.state.visual).toBe('minimized');
    expect(result.state.selectionModeActive).toBe(true);
  });

  it('new task submitted in minimized state triggers auto-expand flag', () => {
    const state = stateWithTasks('minimized', [makeTask({ id: 'task-1' })]);
    const result = sidebarTransition(state, {
      type: 'TASK_ADDED',
      task: makeTask({ id: 'task-2', instruction: 'Fix footer' }),
    });
    expect(result.shouldAutoExpand).toBe(true);
    expect(result.state.tasks.size).toBe(2);
  });

  it('badge counter calculates completed/total correctly', () => {
    const tasks = new Map<string, TaskUpdate>();
    tasks.set('t1', makeTask({ id: 't1', status: 'done' }));
    tasks.set('t2', makeTask({ id: 't2', status: 'error' }));
    tasks.set('t3', makeTask({ id: 't3', status: 'editing' }));
    tasks.set('t4', makeTask({ id: 't4', status: 'queued' }));
    tasks.set('t5', makeTask({ id: 't5', status: 'sending' }));

    const badge = computeBadge(tasks);
    expect(badge.completed).toBe(2); // done + error
    expect(badge.total).toBe(5);
    expect(badge.text).toBe('2/5');
  });

  it('auto-expand timeout collapses expanded -> minimized', () => {
    const state = stateWithTasks('expanded', [makeTask()]);
    const result = sidebarTransition(state, { type: 'AUTO_EXPAND_TIMEOUT' });
    expect(result.state.visual).toBe('minimized');
  });

  it('task update to done while minimized triggers done pulse', () => {
    const state = stateWithTasks('minimized', [makeTask({ id: 'task-1' })]);
    const result = sidebarTransition(state, {
      type: 'TASK_UPDATED',
      task: makeTask({ id: 'task-1', status: 'done' }),
    });
    expect(result.shouldPulse).toBe('done');
  });

  it('task update to error while minimized triggers error pulse', () => {
    const state = stateWithTasks('minimized', [makeTask({ id: 'task-1' })]);
    const result = sidebarTransition(state, {
      type: 'TASK_UPDATED',
      task: makeTask({ id: 'task-1', status: 'error', error: 'Timeout' }),
    });
    expect(result.shouldPulse).toBe('error');
  });

  it('task update while expanded does not pulse', () => {
    const state = stateWithTasks('expanded', [makeTask({ id: 'task-1' })]);
    const result = sidebarTransition(state, {
      type: 'TASK_UPDATED',
      task: makeTask({ id: 'task-1', status: 'done' }),
    });
    expect(result.shouldPulse).toBeNull();
  });

  it('expand is ignored when already expanded', () => {
    const state = stateWithTasks('expanded', [makeTask()]);
    const result = sidebarTransition(state, { type: 'EXPAND' });
    expect(result.state.visual).toBe('expanded');
    expect(result.state).toBe(state); // same reference (no change)
  });

  it('collapse is ignored when already minimized', () => {
    const state = stateWithTasks('minimized', [makeTask()]);
    const result = sidebarTransition(state, { type: 'COLLAPSE' });
    expect(result.state.visual).toBe('minimized');
    expect(result.state).toBe(state); // same reference (no change)
  });

  it('selection mode inactive clears the flag', () => {
    const state: SidebarState = {
      ...stateWithTasks('minimized', [makeTask()]),
      selectionModeActive: true,
    };
    const result = sidebarTransition(state, {
      type: 'SELECTION_MODE_INACTIVE',
    });
    expect(result.state.selectionModeActive).toBe(false);
  });

  it('dismiss one of multiple tasks keeps remaining tasks', () => {
    const state = stateWithTasks('expanded', [
      makeTask({ id: 'task-1' }),
      makeTask({ id: 'task-2', instruction: 'Fix footer' }),
    ]);
    const result = sidebarTransition(state, {
      type: 'TASK_DISMISSED',
      id: 'task-1',
    });
    expect(result.state.tasks.size).toBe(1);
    expect(result.state.tasks.has('task-2')).toBe(true);
    expect(result.state.visual).toBe('expanded');
  });
});

describe('computeBadge', () => {
  it('returns 0/0 for empty tasks', () => {
    const badge = computeBadge(new Map());
    expect(badge.text).toBe('0/0');
  });

  it('counts only done and error as completed', () => {
    const tasks = new Map<string, TaskUpdate>();
    tasks.set('t1', makeTask({ id: 't1', status: 'done' }));
    tasks.set('t2', makeTask({ id: 't2', status: 'sending' }));
    tasks.set('t3', makeTask({ id: 't3', status: 'error' }));

    const badge = computeBadge(tasks);
    expect(badge.completed).toBe(2);
    expect(badge.total).toBe(3);
    expect(badge.text).toBe('2/3');
  });
});
