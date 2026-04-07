// Overlay renderer script
// Phase 2: toolbar display and mode change listener
// Phase 3: selection state machine, rectangle drawing, element hover/click

// ============================================================
// Pure state machine (exported for testing -- no DOM dependency)
// ============================================================

export type OverlayMode =
  | 'inactive'
  | 'rect-idle'
  | 'rect-drawing'
  | 'rect-committed'
  | 'elem-idle'
  | 'elem-hovering'
  | 'elem-committed';

export interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionState {
  mode: OverlayMode;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  hoveredRect: SelectionBounds | null;
  selectionBounds: SelectionBounds | null;
}

export type SelectionEvent =
  | { type: 'ACTIVATE_RECT' }
  | { type: 'ACTIVATE_ELEM' }
  | { type: 'MOUSE_DOWN'; x: number; y: number }
  | { type: 'MOUSE_MOVE'; x: number; y: number }
  | { type: 'MOUSE_UP'; x: number; y: number }
  | { type: 'ELEMENT_HOVER'; rect: SelectionBounds }
  | { type: 'ELEMENT_CLICK' }
  | { type: 'CANCEL' };

export const INITIAL_STATE: SelectionState = {
  mode: 'inactive',
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  hoveredRect: null,
  selectionBounds: null,
};

export const MIN_SELECTION_SIZE = 16;

const RESET_FIELDS = {
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  hoveredRect: null,
  selectionBounds: null,
};

export function transition(
  state: SelectionState,
  event: SelectionEvent,
): SelectionState {
  switch (event.type) {
    case 'ACTIVATE_RECT': {
      // From inactive, any committed, or any idle -> rect-idle
      if (
        state.mode === 'inactive' ||
        state.mode === 'rect-committed' ||
        state.mode === 'elem-committed' ||
        state.mode === 'elem-idle' ||
        state.mode === 'elem-hovering'
      ) {
        return { ...INITIAL_STATE, mode: 'rect-idle' };
      }
      return state;
    }

    case 'ACTIVATE_ELEM': {
      // From inactive, any committed, or any idle -> elem-idle
      if (
        state.mode === 'inactive' ||
        state.mode === 'rect-committed' ||
        state.mode === 'elem-committed' ||
        state.mode === 'rect-idle' ||
        state.mode === 'rect-drawing'
      ) {
        return { ...INITIAL_STATE, mode: 'elem-idle' };
      }
      return state;
    }

    case 'MOUSE_DOWN': {
      if (state.mode === 'rect-idle') {
        return {
          ...state,
          mode: 'rect-drawing',
          startX: event.x,
          startY: event.y,
          currentX: event.x,
          currentY: event.y,
        };
      }
      return state;
    }

    case 'MOUSE_MOVE': {
      if (state.mode === 'rect-drawing') {
        return {
          ...state,
          currentX: event.x,
          currentY: event.y,
        };
      }
      return state;
    }

    case 'MOUSE_UP': {
      if (state.mode === 'rect-drawing') {
        const x = Math.min(state.startX, event.x);
        const y = Math.min(state.startY, event.y);
        const width = Math.abs(event.x - state.startX);
        const height = Math.abs(event.y - state.startY);

        if (width >= MIN_SELECTION_SIZE && height >= MIN_SELECTION_SIZE) {
          return {
            ...state,
            mode: 'rect-committed',
            currentX: event.x,
            currentY: event.y,
            selectionBounds: { x, y, width, height },
          };
        }
        // Too small -- return to idle
        return {
          ...state,
          mode: 'rect-idle',
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0,
          selectionBounds: null,
        };
      }
      return state;
    }

    case 'ELEMENT_HOVER': {
      if (state.mode === 'elem-idle' || state.mode === 'elem-hovering') {
        return {
          ...state,
          mode: 'elem-hovering',
          hoveredRect: event.rect,
        };
      }
      return state;
    }

    case 'ELEMENT_CLICK': {
      if (state.mode === 'elem-hovering' && state.hoveredRect) {
        return {
          ...state,
          mode: 'elem-committed',
          selectionBounds: state.hoveredRect,
        };
      }
      return state;
    }

    case 'CANCEL': {
      if (state.mode !== 'inactive') {
        return { ...INITIAL_STATE };
      }
      return state;
    }

    default:
      return state;
  }
}

// ============================================================
// DOM wiring (only runs in browser environment)
// ============================================================

function isInBrowser(): boolean {
  return typeof document !== 'undefined' && typeof window !== 'undefined';
}

if (isInBrowser()) {
  let state: SelectionState = { ...INITIAL_STATE };
  let elemHoverRafPending = false;

  // Forward-declared so tooltip code (defined later) can be called from dispatch
  let onModeChange: (() => void) | null = null;

  function dispatch(event: SelectionEvent): void {
    const prev = state;
    state = transition(state, event);
    if (state !== prev) {
      render(state);
      // Hide tooltip when mode transitions away from inactive (D-22)
      if (state.mode !== 'inactive' && onModeChange) {
        onModeChange();
      }
    }
  }

  function render(s: SelectionState): void {
    const selectionRect = document.getElementById('claw-selection-rect');
    const elementHighlight = document.getElementById('claw-element-highlight');
    const selectBtn = document.getElementById('claw-select-btn');
    const elemBtn = document.getElementById('claw-elem-btn');

    // Cursor
    if (s.mode === 'rect-idle' || s.mode === 'rect-drawing') {
      document.body.style.cursor = 'crosshair';
    } else {
      document.body.style.cursor = 'default';
    }

    // Selection rectangle visibility and positioning
    if (selectionRect) {
      if (
        s.mode === 'rect-drawing' ||
        s.mode === 'rect-committed'
      ) {
        selectionRect.hidden = false;

        if (s.mode === 'rect-drawing') {
          const x = Math.min(s.startX, s.currentX);
          const y = Math.min(s.startY, s.currentY);
          const w = Math.abs(s.currentX - s.startX);
          const h = Math.abs(s.currentY - s.startY);
          selectionRect.style.left = `${x}px`;
          selectionRect.style.top = `${y}px`;
          selectionRect.style.width = `${w}px`;
          selectionRect.style.height = `${h}px`;
          selectionRect.classList.add('claw-selection-rect--drawing');
          selectionRect.classList.remove('claw-selection-rect--committed');
        } else if (s.mode === 'rect-committed' && s.selectionBounds) {
          selectionRect.style.left = `${s.selectionBounds.x}px`;
          selectionRect.style.top = `${s.selectionBounds.y}px`;
          selectionRect.style.width = `${s.selectionBounds.width}px`;
          selectionRect.style.height = `${s.selectionBounds.height}px`;
          selectionRect.classList.remove('claw-selection-rect--drawing');
          selectionRect.classList.add('claw-selection-rect--committed');
        }
      } else {
        selectionRect.hidden = true;
        selectionRect.classList.remove(
          'claw-selection-rect--drawing',
          'claw-selection-rect--committed',
        );
      }
    }

    // Element highlight visibility and positioning
    if (elementHighlight) {
      if (s.mode === 'elem-hovering' && s.hoveredRect) {
        elementHighlight.hidden = false;
        elementHighlight.style.left = `${s.hoveredRect.x}px`;
        elementHighlight.style.top = `${s.hoveredRect.y}px`;
        elementHighlight.style.width = `${s.hoveredRect.width}px`;
        elementHighlight.style.height = `${s.hoveredRect.height}px`;
        elementHighlight.classList.add('claw-element-highlight--visible');
        elementHighlight.classList.remove('claw-element-highlight--committed');
      } else if (s.mode === 'elem-committed' && s.selectionBounds) {
        elementHighlight.hidden = false;
        elementHighlight.style.left = `${s.selectionBounds.x}px`;
        elementHighlight.style.top = `${s.selectionBounds.y}px`;
        elementHighlight.style.width = `${s.selectionBounds.width}px`;
        elementHighlight.style.height = `${s.selectionBounds.height}px`;
        elementHighlight.classList.remove('claw-element-highlight--visible');
        elementHighlight.classList.add('claw-element-highlight--committed');
      } else {
        elementHighlight.hidden = true;
        elementHighlight.classList.remove(
          'claw-element-highlight--visible',
          'claw-element-highlight--committed',
        );
      }
    }

    // Toolbar button active states
    if (selectBtn) {
      if (
        s.mode === 'rect-idle' ||
        s.mode === 'rect-drawing' ||
        s.mode === 'rect-committed'
      ) {
        selectBtn.classList.add('claw-toolbar-btn--active');
      } else {
        selectBtn.classList.remove('claw-toolbar-btn--active');
      }
    }

    if (elemBtn) {
      if (
        s.mode === 'elem-idle' ||
        s.mode === 'elem-hovering' ||
        s.mode === 'elem-committed'
      ) {
        elemBtn.classList.add('claw-toolbar-btn--active');
      } else {
        elemBtn.classList.remove('claw-toolbar-btn--active');
      }
    }

    // Dispatch custom event on committed selection
    if (
      (s.mode === 'rect-committed' || s.mode === 'elem-committed') &&
      s.selectionBounds
    ) {
      document.dispatchEvent(
        new CustomEvent('claw:selection-committed', {
          detail: { bounds: s.selectionBounds },
        }),
      );
    }
  }

  // --- Event listeners ---

  // Activate/deactivate overlay hit surface
  const toolbar = document.getElementById('claw-toolbar');

  function activateOverlaySurface(): void {
    // Pin toolbar at its current screen position before overlay expands
    if (toolbar) {
      const rect = toolbar.getBoundingClientRect();
      toolbar.style.position = 'fixed';
      toolbar.style.left = `${rect.left}px`;
      toolbar.style.top = `${rect.top}px`;
      toolbar.style.bottom = 'auto';
      toolbar.style.right = 'auto';
    }
    document.body.classList.add('claw-overlay--active');
  }
  function deactivateOverlaySurface(): void {
    document.body.classList.remove('claw-overlay--active');
    // Restore default CSS positioning
    if (toolbar) {
      toolbar.style.position = '';
      toolbar.style.left = '';
      toolbar.style.top = '';
      toolbar.style.bottom = '';
      toolbar.style.right = '';
    }
  }

  // Rectangle select button
  const selectBtn = document.getElementById('claw-select-btn');
  if (selectBtn) {
    selectBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (state.mode === 'inactive' || state.mode === 'elem-idle' || state.mode === 'elem-hovering' || state.mode === 'elem-committed') {
        hideInputBar();
        await window.claw?.activateSelection();
        activateOverlaySurface();
        dispatch({ type: 'ACTIVATE_RECT' });
      } else if (
        state.mode === 'rect-idle' ||
        state.mode === 'rect-drawing' ||
        state.mode === 'rect-committed'
      ) {
        hideInputBar();
        dispatch({ type: 'CANCEL' });
        deactivateOverlaySurface();
        window.claw?.deactivateSelection();
      }
    });
  }

  // Element select button
  const elemBtn = document.getElementById('claw-elem-btn');
  if (elemBtn) {
    elemBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (state.mode === 'inactive' || state.mode === 'rect-idle' || state.mode === 'rect-drawing' || state.mode === 'rect-committed') {
        hideInputBar();
        await window.claw?.activateSelection();
        activateOverlaySurface();
        dispatch({ type: 'ACTIVATE_ELEM' });
      } else if (
        state.mode === 'elem-idle' ||
        state.mode === 'elem-hovering' ||
        state.mode === 'elem-committed'
      ) {
        hideInputBar();
        dispatch({ type: 'CANCEL' });
        deactivateOverlaySurface();
        window.claw?.deactivateSelection();
      }
    });
  }

  // Mouse events for rectangle drawing
  document.addEventListener('mousedown', (e) => {
    if (state.mode === 'rect-idle') {
      dispatch({ type: 'MOUSE_DOWN', x: e.clientX, y: e.clientY });
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (state.mode === 'rect-drawing') {
      dispatch({ type: 'MOUSE_MOVE', x: e.clientX, y: e.clientY });
    } else if (
      (state.mode === 'elem-idle' || state.mode === 'elem-hovering') &&
      !elemHoverRafPending
    ) {
      elemHoverRafPending = true;
      const x = e.clientX;
      const y = e.clientY;
      requestAnimationFrame(async () => {
        elemHoverRafPending = false;
        try {
          const rect = await window.claw.getElementAtPoint(x, y);
          if (rect) {
            dispatch({ type: 'ELEMENT_HOVER', rect });
          }
        } catch {
          // IPC failure -- silently ignore hover
        }
      });
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (state.mode === 'rect-drawing') {
      dispatch({ type: 'MOUSE_UP', x: e.clientX, y: e.clientY });
    }
  });

  // Click for element selection
  document.addEventListener('click', (e) => {
    if (state.mode === 'elem-hovering') {
      e.stopPropagation();
      dispatch({ type: 'ELEMENT_CLICK' });
    }
  });

  // Escape key cancels selection and hides input bar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.mode !== 'inactive') {
      hideInputBar();
      dispatch({ type: 'CANCEL' });
      deactivateOverlaySurface();
      window.claw?.deactivateSelection();
    }
  });

  // ============================================================
  // Input bar: smart positioning, show/hide, auto-expand, submit
  // ============================================================

  function positionInputBar(bounds: SelectionBounds): void {
    const inputBar = document.getElementById('claw-input-bar')!;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const MIN_EDGE_MARGIN = 16;
    const SPACE_THRESHOLD = 80;
    const INPUT_GAP = 8;

    // Width: match selection width, clamped to [240, 480]
    const barWidth = Math.max(240, Math.min(480, bounds.width));
    inputBar.style.width = `${barWidth}px`;

    // Horizontal: align to selection left, clamp to viewport
    let left = bounds.x;
    if (left + barWidth > viewportWidth - MIN_EDGE_MARGIN) {
      left = viewportWidth - MIN_EDGE_MARGIN - barWidth;
    }
    if (left < MIN_EDGE_MARGIN) left = MIN_EDGE_MARGIN;
    inputBar.style.left = `${left}px`;

    // Vertical: prefer below selection, fall back to above
    const spaceBelow = viewportHeight - (bounds.y + bounds.height);
    const spaceAbove = bounds.y;

    if (spaceBelow >= SPACE_THRESHOLD) {
      inputBar.style.top = `${bounds.y + bounds.height + INPUT_GAP}px`;
      inputBar.style.bottom = '';
    } else if (spaceAbove >= SPACE_THRESHOLD) {
      inputBar.style.top = '';
      inputBar.style.bottom = `${viewportHeight - bounds.y + INPUT_GAP}px`;
    } else {
      // Neither has enough space -- put below anyway
      inputBar.style.top = `${bounds.y + bounds.height + INPUT_GAP}px`;
      inputBar.style.bottom = '';
    }
  }

  function showInputBar(bounds: SelectionBounds): void {
    const inputBar = document.getElementById('claw-input-bar')!;
    const textarea = document.getElementById('claw-input-textarea') as HTMLTextAreaElement;

    inputBar.hidden = false;
    positionInputBar(bounds);

    // Trigger entrance animation (per UI spec: opacity 0->1, translateY 4px->0, 150ms ease-out)
    requestAnimationFrame(() => {
      inputBar.classList.add('claw-input-bar--visible');
    });

    // Focus textarea (per accessibility contract)
    textarea.value = '';
    textarea.style.height = 'auto';
    textarea.focus();
  }

  function hideInputBar(): void {
    const inputBar = document.getElementById('claw-input-bar')!;
    inputBar.classList.remove('claw-input-bar--visible');
    pastedImages.length = 0;
    setTimeout(() => {
      inputBar.hidden = true;
    }, 100);
  }

  // Pasted reference images
  const pastedImages: Array<{ dataUrl: string; buffer: ArrayBuffer }> = [];

  // Model selector — restore preference from localStorage
  const modelSelect = document.getElementById('claw-model-select') as HTMLSelectElement;
  const savedModel = localStorage.getItem('claw-model');
  if (savedModel && modelSelect.querySelector(`option[value="${savedModel}"]`)) {
    modelSelect.value = savedModel;
  }
  modelSelect.addEventListener('change', () => {
    localStorage.setItem('claw-model', modelSelect.value);
  });

  // Auto-expanding textarea (per D-10)
  const textarea = document.getElementById('claw-input-textarea') as HTMLTextAreaElement;
  const submitBtn = document.getElementById('claw-input-submit')!;

  textarea.addEventListener('input', () => {
    // Auto-expand: reset height, set to scrollHeight, cap at max
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 160);
    textarea.style.height = `${newHeight}px`;

    // Enable/disable submit button (keep enabled if images are pasted)
    if (textarea.value.trim() || pastedImages.length > 0) {
      submitBtn.classList.add('claw-input-bar__submit--enabled');
      submitBtn.removeAttribute('disabled');
    } else {
      submitBtn.classList.remove('claw-input-bar__submit--enabled');
      submitBtn.setAttribute('disabled', '');
    }
  });

  // Paste handler: capture images from clipboard
  textarea.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const arrayBuf = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0)).buffer;
          pastedImages.push({ dataUrl, buffer: arrayBuf });
          const imageNum = pastedImages.length;
          // Insert [Image #N] tag at cursor position in textarea
          const pos = textarea.selectionStart;
          const before = textarea.value.slice(0, pos);
          const after = textarea.value.slice(pos);
          const tag = `[Image #${imageNum}]`;
          textarea.value = before + tag + after;
          textarea.selectionStart = textarea.selectionEnd = pos + tag.length;
          // Auto-expand textarea height
          textarea.style.height = 'auto';
          textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
          // Enable submit button directly
          submitBtn.classList.add('claw-input-bar__submit--enabled');
          submitBtn.removeAttribute('disabled');
          textarea.focus();
        };
        reader.readAsDataURL(blob);
      }
    }
  });



  // Keyboard handling (per D-11): Enter submits, Shift+Enter adds newline
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Shift+Enter: default textarea behavior (newline) -- no preventDefault
  });

  // Submit handler
  async function handleSubmit(): Promise<void> {
    const instruction = textarea.value.trim();
    if ((!instruction && pastedImages.length === 0) || !state.selectionBounds) return;

    const bounds = state.selectionBounds;

    // Capture screenshot and extract DOM in parallel
    const [screenshot, dom] = await Promise.all([
      window.claw.captureScreenshot(bounds),
      window.claw.extractDom(bounds),
    ]);

    // Only include pasted images whose [Image #N] tag is still in the text
    const referenceImages: Buffer[] = [];
    for (let i = 0; i < pastedImages.length; i++) {
      if (instruction.includes(`[Image #${i + 1}]`)) {
        referenceImages.push(Buffer.from(new Uint8Array(pastedImages[i].buffer)));
      }
    }
    // If images were pasted but none are referenced, include all (no-tag usage)
    if (pastedImages.length > 0 && referenceImages.length === 0 && !/\[Image #\d+\]/.test(instruction)) {
      for (const img of pastedImages) {
        referenceImages.push(Buffer.from(new Uint8Array(img.buffer)));
      }
    }

    // Submit instruction with all context to main process
    await window.claw.submitInstruction({
      instruction: instruction || 'Make the changes shown in the reference image(s)',
      screenshot,
      dom,
      bounds,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      model: modelSelect.value,
    });

    // Clear pasted images
    pastedImages.length = 0;

    // Per D-12: after submit, selection and input disappear, return to inactive
    hideInputBar();
    // Dispatch CANCEL to clear selection state
    dispatch({ type: 'CANCEL' });
    // Deactivate overlay (shrink bounds) per D-12
    deactivateOverlaySurface();
    await window.claw.deactivateSelection();
  }

  submitBtn.addEventListener('click', handleSubmit);

  // Wire selection-committed listener: show input bar after selection committed
  document.addEventListener('claw:selection-committed', ((e: CustomEvent) => {
    showInputBar(e.detail.bounds);
  }) as EventListener);

  // ============================================================
  // Toast notification system (D-08, D-09, D-10)
  // ============================================================

  // Import toast functions from extracted module
  import('./toast.js').then(({ showToast, dismissToast }) => {
    // Wire toast IPC listeners via preload API
    if (window.claw?.onToastShow) {
      window.claw.onToastShow((data) => showToast(document, data));
    }
    if (window.claw?.onToastDismiss) {
      window.claw.onToastDismiss((data) => dismissToast(document, data.id));
    }
  });

  // Listen for overlay mode changes from main process
  if (window.claw?.onModeChange) {
    window.claw.onModeChange((mode: string) => {
      console.debug('[claw-overlay] mode:', mode);
    });
  }

  // Wire prefill for retry: when retry is clicked in sidebar, the overlay receives the
  // original instruction to pre-populate the textarea AND activates selection mode so
  // the user can make a new selection and edit the instruction before re-submitting.
  if (window.claw?.onPrefillInstruction) {
    window.claw.onPrefillInstruction((data: { instruction: string }) => {
      const ta = document.getElementById('claw-input-textarea') as HTMLTextAreaElement;
      if (ta) {
        ta.value = data.instruction;
        // Trigger auto-expand and enable submit button
        ta.dispatchEvent(new Event('input'));
      }

      // Activate overlay surface for interaction (body class + toolbar pinning)
      activateOverlaySurface();

      // Enter rect-idle selection mode so user can draw a new selection
      dispatch({ type: 'ACTIVATE_RECT' });

      // Show input bar at default position (no selection yet -- center at 60% height)
      const inputBar = document.getElementById('claw-input-bar')!;
      inputBar.hidden = false;
      inputBar.style.left = '50%';
      inputBar.style.transform = 'translateX(-50%)';
      inputBar.style.top = `${Math.round(window.innerHeight * 0.6)}px`;
      inputBar.style.bottom = '';
      requestAnimationFrame(() => {
        inputBar.classList.add('claw-input-bar--visible');
      });

      // Focus textarea so user can immediately edit (accessibility: keyboard focus)
      if (ta) {
        ta.focus();
      }
    });
  }

  // ============================================================
  // Toolbar drag handling: move overlay view via IPC
  // ============================================================

  const toolbarHandle = document.querySelector('.claw-toolbar-handle') as HTMLElement | null;
  if (toolbarHandle) {
    let isDragging = false;
    let lastScreenX = 0;
    let lastScreenY = 0;

    toolbarHandle.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastScreenX = e.screenX;
      lastScreenY = e.screenY;
      toolbarHandle.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.screenX - lastScreenX;
      const dy = e.screenY - lastScreenY;
      lastScreenX = e.screenX;
      lastScreenY = e.screenY;
      if (dx !== 0 || dy !== 0) {
        window.claw.dragToolbar(dx, dy);
      }
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      toolbarHandle.style.cursor = '';
      // Save final position to localStorage for restore on next launch
      window.claw.dragToolbar(0, 0).then((pos: { x: number; y: number }) => {
        localStorage.setItem('claw-toolbar-pos', JSON.stringify(pos));
      });
    });

    // Restore saved toolbar position from localStorage
    const savedToolbarPos = localStorage.getItem('claw-toolbar-pos');
    if (savedToolbarPos) {
      try {
        const { x, y } = JSON.parse(savedToolbarPos);
        if (typeof x === 'number' && typeof y === 'number') {
          window.claw.setToolbarPosition(x, y);
        }
      } catch {
        // Corrupted data -- ignore
      }
    }
  }

  // ============================================================
  // Viewport switching (D-01 through D-07, ELEC-03)
  // ============================================================

  let activeViewport: string = 'desktop';
  let viewportGroupOpen = false;

  const viewportToggleBtn = document.getElementById('claw-viewport-toggle-btn');
  const viewportGroup = document.getElementById('claw-viewport-group');

  const viewportButtons: Record<string, HTMLElement | null> = {
    desktop: document.getElementById('claw-viewport-desktop-btn'),
    tablet: document.getElementById('claw-viewport-tablet-btn'),
    mobile: document.getElementById('claw-viewport-mobile-btn'),
  };

  function toggleViewportGroup(): void {
    if (!viewportGroup) return;
    viewportGroupOpen = !viewportGroupOpen;
    if (viewportGroupOpen) {
      viewportGroup.classList.add('claw-viewport-group--open');
      viewportToggleBtn?.classList.add('claw-toolbar-btn--toggle-open');
    } else {
      viewportGroup.classList.remove('claw-viewport-group--open');
      viewportToggleBtn?.classList.remove('claw-toolbar-btn--toggle-open');
    }
  }

  if (viewportToggleBtn) {
    viewportToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleViewportGroup();
    });
  }

  function updateViewportActiveState(preset: string): void {
    for (const [key, btn] of Object.entries(viewportButtons)) {
      if (!btn) continue;
      if (key === preset) {
        btn.classList.add('claw-toolbar-btn--active');
      } else {
        btn.classList.remove('claw-toolbar-btn--active');
      }
    }
    activeViewport = preset;
  }

  // Click handlers for viewport buttons
  for (const [preset, btn] of Object.entries(viewportButtons)) {
    if (!btn) continue;
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (activeViewport === preset) return; // Already active
      updateViewportActiveState(preset);
      await window.claw.setViewport(preset);
      // Collapse the group after selection
      if (viewportGroupOpen) toggleViewportGroup();
    });
  }

  // Listen for viewport changes from main process (sync state)
  if (window.claw?.onViewportChanged) {
    window.claw.onViewportChanged((data: { preset: string }) => {
      updateViewportActiveState(data.preset);
    });
  }

  // ============================================================
  // Tooltips (D-22) -- hover delay, positioned left of toolbar
  // ============================================================

  const tooltipEl = document.getElementById('claw-tooltip');
  let tooltipTimer: ReturnType<typeof setTimeout> | null = null;
  let tooltipActiveBtn: HTMLElement | null = null;

  function showTooltipForBtn(btn: HTMLElement): void {
    if (!tooltipEl) return;
    const text = btn.getAttribute('data-tooltip');
    if (!text) return;

    // Don't show during active selection modes (D-22: "Hidden while any selection mode is active")
    if (state.mode !== 'inactive') return;

    tooltipEl.textContent = text;
    tooltipEl.hidden = false;
    tooltipActiveBtn = btn;

    // Position: left of the button, vertically centered, 8px gap
    const btnRect = btn.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const left = btnRect.left - tooltipRect.width - 8;
    const top = btnRect.top + (btnRect.height - tooltipRect.height) / 2;
    tooltipEl.style.left = `${Math.max(4, left)}px`;
    tooltipEl.style.top = `${Math.max(4, top)}px`;

    // Set aria-describedby on the button
    btn.setAttribute('aria-describedby', 'claw-tooltip');
  }

  function hideTooltip(): void {
    if (!tooltipEl) return;
    tooltipEl.hidden = true;
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }
    if (tooltipActiveBtn) {
      tooltipActiveBtn.removeAttribute('aria-describedby');
      tooltipActiveBtn = null;
    }
  }

  // Wire tooltip events on all toolbar buttons with data-tooltip
  const tooltipButtons = document.querySelectorAll('[data-tooltip]');
  for (const btn of tooltipButtons) {
    btn.addEventListener('mouseenter', () => {
      // 400ms hover delay (D-22: prevents flicker during fast mouse movement)
      tooltipTimer = setTimeout(() => {
        showTooltipForBtn(btn as HTMLElement);
      }, 400);
    });

    btn.addEventListener('mouseleave', () => {
      hideTooltip();
    });
  }

  // Wire tooltip hide into dispatch mode-change callback
  onModeChange = hideTooltip;

  // ============================================================
  // Loading indicator: hide when site finishes loading
  // ============================================================

  if (window.claw?.onSiteLoaded) {
    window.claw.onSiteLoaded(() => {
      const loadingEl = document.getElementById('claw-loading');
      if (loadingEl) loadingEl.classList.add('claw-loading--hidden');
    });
  }
}
