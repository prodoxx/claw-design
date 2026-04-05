// Sidebar renderer: task rendering, expand/collapse, badge updates, animations
// Consumes window.clawSidebar API from preload/sidebar.ts

import {
  sidebarTransition,
  computeBadge,
  INITIAL_SIDEBAR_STATE,
  type SidebarState,
  type SidebarEvent,
  type TaskUpdate,
  type SidebarVisualState,
} from './sidebar-state.js';

// ============================================================
// Type declaration for sidebar preload API
// ============================================================

interface TaskLogEntry {
  timestamp: number;
  type: string;
  content: string;
}

declare global {
  interface Window {
    clawSidebar: {
      onTaskUpdate: (cb: (data: TaskUpdate) => void) => void;
      expand: () => Promise<void>;
      collapse: () => Promise<void>;
      dismissTask: (id: string) => Promise<void>;
      retryTask: (id: string) => Promise<void>;
      getTaskLogs: (id: string) => Promise<TaskLogEntry[]>;
      onStateChange: (cb: (state: 'hidden' | 'minimized' | 'expanded') => void) => void;
      dragDelta: (dx: number, dy: number) => Promise<{ x: number; y: number }>;
      setPosition: (x: number, y: number) => Promise<void>;
    };
  }
}

// ============================================================
// State
// ============================================================

let state: SidebarState = { ...INITIAL_SIDEBAR_STATE, tasks: new Map() };
let autoExpandTimer: ReturnType<typeof setTimeout> | null = null;
const expandedLogs = new Set<string>(); // task IDs with visible log panels

// Status badge label copy (per copywriting contract)
const STATUS_LABELS: Record<TaskUpdate['status'], string> = {
  queued: 'Queued',
  sending: 'Sending',
  editing: 'Editing',
  done: 'Done',
  error: 'Error',
};

// ============================================================
// DOM element refs (resolved once on DOMContentLoaded)
// ============================================================

let minimizedEl: HTMLElement;
let expandedEl: HTMLElement;
let expandBtn: HTMLElement;
let minimizeBtn: HTMLElement;
let taskListEl: HTMLElement;
let badgeEl: HTMLElement;
let badgeTextEl: HTMLElement;

// ============================================================
// SVG helpers (safe DOM construction -- no innerHTML)
// ============================================================

const SVG_NS = 'http://www.w3.org/2000/svg';

function createDismissSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('fill', 'none');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M2 2L10 10M10 2L2 10');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-linecap', 'round');
  svg.appendChild(path);

  return svg;
}

// ============================================================
// Core functions
// ============================================================

/**
 * Create or update a task row in the DOM.
 */
export function renderTask(task: TaskUpdate): void {
  const existingRow = taskListEl.querySelector(
    `[data-task-id="${task.id}"]`,
  ) as HTMLElement | null;

  if (existingRow) {
    updateTaskRow(existingRow, task);
  } else {
    const row = createTaskRow(task);
    // Prepend: newest on top
    taskListEl.prepend(row);
  }
}

function createTaskRow(task: TaskUpdate): HTMLElement {
  const row = document.createElement('div');
  row.className = 'task-row';
  row.dataset.taskId = task.id;
  row.setAttribute(
    'aria-label',
    `${task.instruction}, status: ${task.status}`,
  );

  // Instruction text (clickable to toggle logs)
  const instructionEl = document.createElement('div');
  instructionEl.className =
    task.status === 'error' ? 'task-instruction error-row' : 'task-instruction';
  instructionEl.textContent = task.instruction;
  instructionEl.addEventListener('click', () => toggleLogs(task.id, row));
  row.appendChild(instructionEl);

  // Activity text (streaming what Claude is doing)
  const activityEl = document.createElement('div');
  activityEl.className = 'task-activity';
  activityEl.textContent = task.activity ?? '';
  activityEl.style.display = task.activity ? '' : 'none';
  row.appendChild(activityEl);

  // Status row (badge + dismiss icon)
  const statusRow = document.createElement('div');
  statusRow.className = 'task-status-row';

  const badge = document.createElement('span');
  badge.className = `status-badge ${task.status}`;
  badge.textContent = STATUS_LABELS[task.status];
  statusRow.appendChild(badge);

  // Dismiss icon button for done rows (visible on hover via CSS)
  if (task.status === 'done') {
    const dismissIcon = createDismissIconButton(task.id);
    statusRow.appendChild(dismissIcon);
  }

  row.appendChild(statusRow);

  // Error-specific elements
  if (task.status === 'error') {
    appendErrorElements(row, task);
  }

  return row;
}

function updateTaskRow(row: HTMLElement, task: TaskUpdate): void {
  row.setAttribute(
    'aria-label',
    `${task.instruction}, status: ${task.status}`,
  );

  // Update instruction class for error styling
  const instructionEl = row.querySelector('.task-instruction');
  if (instructionEl) {
    instructionEl.className =
      task.status === 'error'
        ? 'task-instruction error-row'
        : 'task-instruction';
  }

  // Update activity text
  const activityEl = row.querySelector('.task-activity') as HTMLElement | null;
  if (activityEl) {
    activityEl.textContent = task.activity ?? '';
    activityEl.style.display = task.activity ? '' : 'none';
  }

  // Update status badge
  const badge = row.querySelector('.status-badge');
  if (badge) {
    badge.className = `status-badge ${task.status}`;
    badge.textContent = STATUS_LABELS[task.status];
  }

  // Remove existing dismiss icon, error message, and button row
  const existingDismissIcon = row.querySelector('.task-row-dismiss-btn');
  if (existingDismissIcon) existingDismissIcon.remove();

  const existingErrorMsg = row.querySelector('.task-error-message');
  if (existingErrorMsg) existingErrorMsg.remove();

  const existingButtonRow = row.querySelector('.task-button-row');
  if (existingButtonRow) existingButtonRow.remove();

  // Add dismiss icon button for done rows
  if (task.status === 'done') {
    const statusRow = row.querySelector('.task-status-row');
    if (statusRow) {
      statusRow.appendChild(createDismissIconButton(task.id));
    }
  }

  // Add error elements
  if (task.status === 'error') {
    appendErrorElements(row, task);
  }

  // If logs are expanded for this task, refresh them
  if (expandedLogs.has(task.id)) {
    refreshLogs(task.id, row);
  }
}

function createDismissIconButton(taskId: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'task-row-dismiss-btn';
  btn.setAttribute('aria-label', 'Dismiss task');
  btn.appendChild(createDismissSvg());
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleDismiss(taskId);
  });
  return btn;
}

function appendErrorElements(row: HTMLElement, task: TaskUpdate): void {
  // Error message
  if (task.error) {
    const errorMsg = document.createElement('div');
    errorMsg.className = 'task-error-message';
    errorMsg.textContent = task.error;
    row.appendChild(errorMsg);
  }

  // Button row: Retry + Dismiss
  const buttonRow = document.createElement('div');
  buttonRow.className = 'task-button-row';

  const retryBtn = document.createElement('button');
  retryBtn.className = 'btn-retry';
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.clawSidebar.retryTask(task.id);
  });
  buttonRow.appendChild(retryBtn);

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'btn-dismiss';
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleDismiss(task.id);
  });
  buttonRow.appendChild(dismissBtn);

  row.appendChild(buttonRow);
}

/**
 * Toggle log view for a task.
 */
async function toggleLogs(taskId: string, row: HTMLElement): Promise<void> {
  const existing = row.querySelector('.task-logs');
  if (existing) {
    existing.remove();
    expandedLogs.delete(taskId);
    return;
  }

  expandedLogs.add(taskId);
  await refreshLogs(taskId, row);
}

/**
 * Fetch and render logs for a task.
 */
async function refreshLogs(taskId: string, row: HTMLElement): Promise<void> {
  const logs = await window.clawSidebar.getTaskLogs(taskId);

  // Remove existing log panel if any
  const existing = row.querySelector('.task-logs');
  if (existing) existing.remove();

  if (logs.length === 0) {
    const logsEl = document.createElement('div');
    logsEl.className = 'task-logs';
    logsEl.textContent = 'No logs yet...';
    // Insert after activity or instruction
    const activityEl = row.querySelector('.task-activity');
    const insertAfter = activityEl ?? row.querySelector('.task-instruction');
    insertAfter?.after(logsEl);
    return;
  }

  const logsEl = document.createElement('div');
  logsEl.className = 'task-logs';

  for (const entry of logs) {
    const line = document.createElement('div');
    line.className = `task-log-entry log-${entry.type}`;
    line.textContent = entry.content;
    logsEl.appendChild(line);
  }

  // Insert after activity or instruction
  const activityEl = row.querySelector('.task-activity');
  const insertAfter = activityEl ?? row.querySelector('.task-instruction');
  insertAfter?.after(logsEl);

  // Scroll to bottom
  logsEl.scrollTop = logsEl.scrollHeight;
}

/**
 * Update badge counter text and visibility.
 */
export function updateBadge(): void {
  const badge = computeBadge(state.tasks);
  badgeTextEl.textContent = badge.text;
  badgeEl.style.display = badge.total > 0 ? '' : 'none';
}

/**
 * Trigger a single-shot pulse animation on the badge.
 */
function triggerBadgePulse(type: 'done' | 'error'): void {
  const cls = type === 'done' ? 'pulse-done' : 'pulse-error';
  // Remove first in case already animating
  badgeEl.classList.remove('pulse-done', 'pulse-error');
  // Force reflow to restart animation
  void badgeEl.offsetWidth;
  badgeEl.classList.add(cls);

  const onEnd = (): void => {
    badgeEl.classList.remove(cls);
    badgeEl.removeEventListener('animationend', onEnd);
  };
  badgeEl.addEventListener('animationend', onEnd);
}

/**
 * Expand the sidebar panel.
 */
function handleExpand(): void {
  window.clawSidebar.expand();
  const result = sidebarTransition(state, { type: 'EXPAND' });
  state = result.state;
  updateSidebarState(state.visual);
}

/**
 * Collapse the sidebar to minimized state.
 */
function handleCollapse(): void {
  window.clawSidebar.collapse();
  const result = sidebarTransition(state, { type: 'COLLAPSE' });
  state = result.state;
  updateSidebarState(state.visual);
}

/**
 * Expand the sidebar for a new task. Stays expanded (no auto-collapse).
 */
function autoExpandForTask(): void {
  if (autoExpandTimer !== null) {
    clearTimeout(autoExpandTimer);
    autoExpandTimer = null;
  }

  window.clawSidebar.expand();
  const result = sidebarTransition(state, { type: 'EXPAND' });
  state = result.state;
  updateSidebarState(state.visual);
}

/**
 * Dismiss a task: remove from DOM, update state, refresh badge.
 */
function handleDismiss(taskId: string): void {
  // Remove from DOM
  const row = taskListEl.querySelector(`[data-task-id="${taskId}"]`);
  if (row) row.remove();

  // Update state
  const result = sidebarTransition(state, {
    type: 'TASK_DISMISSED',
    id: taskId,
  });
  state = result.state;

  updateBadge();
  window.clawSidebar.dismissTask(taskId);

  // If no tasks remain, state transitions to hidden
  if (state.visual === 'hidden') {
    updateSidebarState('hidden');
  }
}

/**
 * Update sidebar visual state: show/hide minimized and expanded containers.
 */
export function updateSidebarState(visual: SidebarVisualState): void {
  switch (visual) {
    case 'hidden':
      minimizedEl.style.display = 'none';
      expandedEl.style.display = 'none';
      break;
    case 'minimized':
      minimizedEl.style.display = '';
      expandedEl.style.display = 'none';
      break;
    case 'expanded':
      minimizedEl.style.display = 'none';
      expandedEl.style.display = '';
      break;
  }
}

// ============================================================
// Drag handling: move sidebar view via IPC
// ============================================================

function setupDrag(handleEl: HTMLElement): void {
  let isDragging = false;
  let lastScreenX = 0;
  let lastScreenY = 0;

  handleEl.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastScreenX = e.screenX;
    lastScreenY = e.screenY;
    handleEl.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.screenX - lastScreenX;
    const dy = e.screenY - lastScreenY;
    lastScreenX = e.screenX;
    lastScreenY = e.screenY;
    if (dx !== 0 || dy !== 0) {
      window.clawSidebar.dragDelta(dx, dy);
    }
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    handleEl.style.cursor = '';
    // Save final position to localStorage for restore on next launch
    window.clawSidebar.dragDelta(0, 0).then((pos) => {
      localStorage.setItem('claw-sidebar-pos', JSON.stringify(pos));
    });
  });
}

// ============================================================
// Event wiring (on DOMContentLoaded)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Resolve DOM refs
  minimizedEl = document.getElementById('sidebar-minimized')!;
  expandedEl = document.getElementById('sidebar-expanded')!;
  expandBtn = document.getElementById('sidebar-expand-btn')!;
  minimizeBtn = document.getElementById('sidebar-minimize-btn')!;
  taskListEl = document.getElementById('sidebar-task-list')!;
  badgeEl = document.getElementById('sidebar-badge')!;
  badgeTextEl = document.getElementById('sidebar-badge-text')!;

  // 1. Listen for task updates from main process
  window.clawSidebar.onTaskUpdate((data: TaskUpdate) => {
    const isNew = !state.tasks.has(data.id);

    if (isNew) {
      // New task added
      const result = sidebarTransition(state, {
        type: 'TASK_ADDED',
        task: data,
      });
      state = result.state;

      renderTask(data);
      updateBadge();

      if (result.shouldAutoExpand) {
        autoExpandForTask();
      } else {
        updateSidebarState(state.visual);
      }
    } else {
      // Existing task updated
      const result = sidebarTransition(state, {
        type: 'TASK_UPDATED',
        task: data,
      });
      state = result.state;

      renderTask(data);
      updateBadge();

      if (result.shouldPulse) {
        triggerBadgePulse(result.shouldPulse);
      }
    }
  });

  // 2. Expand button click
  expandBtn.addEventListener('click', handleExpand);

  // 3. Minimize button click
  minimizeBtn.addEventListener('click', handleCollapse);

  // 3b. Clear all finished tasks
  const clearBtn = document.getElementById('sidebar-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const finishedIds: string[] = [];
      for (const [id, task] of state.tasks) {
        if (task.status === 'done' || task.status === 'error') {
          finishedIds.push(id);
        }
      }
      for (const id of finishedIds) {
        handleDismiss(id);
      }
    });
  }

  // 4. Cancel auto-expand on user interaction with expanded panel
  expandedEl.addEventListener('mouseenter', () => {
    if (autoExpandTimer !== null) {
      clearTimeout(autoExpandTimer);
      autoExpandTimer = null;
    }
  });

  // 5. Listen for state changes from main process (e.g. D-08 auto-minimize)
  window.clawSidebar.onStateChange((newState) => {
    const result = sidebarTransition(state, {
      type: newState === 'expanded' ? 'EXPAND' : newState === 'minimized' ? 'COLLAPSE' : 'TASK_DISMISSED',
      ...(newState === 'hidden' ? { id: '' } : {}),
    } as SidebarEvent);
    state = { ...result.state, visual: newState as SidebarVisualState };
    updateSidebarState(newState as SidebarVisualState);
    updateBadge();
  });

  // 6. Wire drag handles for sidebar repositioning
  const dragHandle = document.getElementById('sidebar-drag-handle');
  if (dragHandle) setupDrag(dragHandle);

  const expandedDragHandle = document.getElementById('sidebar-expanded-drag-handle');
  if (expandedDragHandle) setupDrag(expandedDragHandle);

  // 7. Restore saved position from localStorage
  const savedPos = localStorage.getItem('claw-sidebar-pos');
  if (savedPos) {
    try {
      const { x, y } = JSON.parse(savedPos);
      if (typeof x === 'number' && typeof y === 'number') {
        window.clawSidebar.setPosition(x, y);
      }
    } catch {
      // Corrupted data -- ignore
    }
  }
});
