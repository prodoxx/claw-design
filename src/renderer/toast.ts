// Toast notification system (D-08, D-09, D-10)
// Extracted as a testable module -- pure DOM manipulation with document injection.
// All text is set via textContent (not innerHTML) per T-05-01 threat mitigation.

// ============================================================
// Types
// ============================================================

export interface ToastData {
  id: string;
  severity: 'info' | 'warning' | 'error';
  title?: string;
  message: string;
  persistent: boolean;
}

// ============================================================
// Module-level state for auto-dismiss timers
// ============================================================

const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ============================================================
// Icon construction (safe SVG via createElementNS -- no innerHTML)
// ============================================================

function createToastIcon(doc: Document, severity: string): SVGSVGElement {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'none');
  svg.classList.add('claw-toast__icon');

  if (severity === 'error') {
    // Triangle warning icon
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M10 2L18 16H2L10 2Z');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('fill', 'none');
    svg.appendChild(path);
    const line = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', 'M10 8V11M10 13.5V14');
    line.setAttribute('stroke', 'currentColor');
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-linecap', 'round');
    svg.appendChild(line);
  } else {
    // Circle info/warning icon
    const circle = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '10');
    circle.setAttribute('cy', '10');
    circle.setAttribute('r', '8');
    circle.setAttribute('stroke', 'currentColor');
    circle.setAttribute('stroke-width', '1.5');
    circle.setAttribute('fill', 'none');
    svg.appendChild(circle);
    const line = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', 'M10 7V7.01M10 10V14');
    line.setAttribute('stroke', 'currentColor');
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-linecap', 'round');
    svg.appendChild(line);
  }

  return svg;
}

// ============================================================
// Public API (document-injected for testability)
// ============================================================

/**
 * Create a toast DOM element without inserting it into the document.
 * Uses textContent exclusively for all text -- no innerHTML per T-05-01.
 */
export function createToastElement(doc: Document, data: ToastData): HTMLElement {
  const toast = doc.createElement('div');
  toast.className = `claw-toast claw-toast--${data.severity}`;
  toast.dataset.toastId = data.id;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', data.persistent ? 'assertive' : 'polite');

  // Icon (safe SVG construction via createElementNS)
  const icon = createToastIcon(doc, data.severity);
  toast.appendChild(icon);

  // Content container
  const content = doc.createElement('div');
  content.className = 'claw-toast__content';

  if (data.title) {
    const titleEl = doc.createElement('div');
    titleEl.className = 'claw-toast__title';
    titleEl.textContent = data.title;
    content.appendChild(titleEl);
  }

  const msgEl = doc.createElement('div');
  msgEl.className = 'claw-toast__message';
  msgEl.textContent = data.message;
  content.appendChild(msgEl);

  // Dismiss button for persistent toasts
  if (data.persistent) {
    const dismissBtn = doc.createElement('button');
    dismissBtn.className = 'claw-toast__dismiss';
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.setAttribute('aria-label', 'Dismiss notification');
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissToast(doc, data.id);
    });
    content.appendChild(dismissBtn);
  }

  toast.appendChild(content);
  return toast;
}

/**
 * Show a toast notification in the container.
 * Non-persistent toasts auto-dismiss after 5000ms (per UI-SPEC).
 */
export function showToast(doc: Document, data: ToastData): void {
  const container = doc.getElementById('claw-toast-container');
  if (!container) return;

  const toast = createToastElement(doc, data);
  container.prepend(toast);

  // Trigger entrance animation on next frame
  requestAnimationFrame(() => {
    toast.classList.add('claw-toast--visible');
  });

  // Auto-dismiss for non-persistent (5000ms per UI-SPEC)
  if (!data.persistent) {
    const timer = setTimeout(() => dismissToast(doc, data.id), 5000);
    toastTimers.set(data.id, timer);
    // Click to dismiss immediately
    toast.addEventListener('click', () => dismissToast(doc, data.id));
    toast.style.cursor = 'pointer';
  }
}

/**
 * Dismiss (remove) a toast by its id.
 * Plays exit animation (150ms) before removing from DOM.
 */
export function dismissToast(doc: Document, id: string): void {
  const container = doc.getElementById('claw-toast-container');
  if (!container) return;

  const toast = container.querySelector(`[data-toast-id="${CSS.escape(id)}"]`) as HTMLElement | null;
  if (!toast) return;

  // Clear auto-dismiss timer if exists
  const timer = toastTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    toastTimers.delete(id);
  }

  // Exit animation then remove
  toast.classList.remove('claw-toast--visible');
  toast.classList.add('claw-toast--exiting');
  setTimeout(() => {
    toast.remove();
  }, 150); // matches exit animation duration
}
