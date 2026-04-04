# Phase 3: Selection Overlay & Capture - Research

**Researched:** 2026-04-04
**Domain:** Electron overlay interaction (selection drawing, screenshot capture, DOM extraction, instruction input)
**Confidence:** HIGH

## Summary

Phase 3 builds the core interaction loop on top of Phase 2's dual-WebContentsView architecture: user draws a rectangle or clicks an element on the overlay, sees it highlighted, types a change instruction, and submits it. The phase involves four distinct technical domains: (1) freeform rectangle drawing and element hover detection in the overlay renderer, (2) cross-view communication to detect elements in the site view from overlay mouse events, (3) DPI-aware screenshot capture via `webContents.capturePage()`, and (4) DOM serialization via `webContents.executeJavaScript()`.

The existing codebase provides a solid foundation. Phase 2 delivered the overlay bounds toggle (`setOverlayActive`/`setOverlayInactive`), IPC scaffolding (`overlay:activate-selection`/`overlay:deactivate-selection`), the preload API (`activateSelection`, `onModeChange`), and the toolbar with one button. Phase 3 extends all of these. The transparent WebContentsView compositing issue (electron/electron#42335) was fixed in Electron 32 and should not affect Electron 36, but the recommendation is to validate this visually in a Wave 0 prototype task.

**Primary recommendation:** Build the selection UI entirely in vanilla HTML/CSS/TS in the overlay renderer (no framework). Use IPC to the main process for all cross-view operations: element detection on the site view (`executeJavaScript` with `document.elementFromPoint()`), screenshot capture (`siteView.webContents.capturePage()`), and DOM extraction (`siteView.webContents.executeJavaScript()`). The overlay renderer handles drawing, positioning, and input; the main process handles site view interrogation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Default mode is freeform rectangle. User clicks the select button in toolbar -> crosshair cursor -> draw a box.
- **D-02:** Element click is a secondary mode, toggled via a second button in the toolbar. Persistent until switched back.
- **D-03:** Cancel selection: both Escape key and clicking the toolbar select button again return overlay to inactive state. Multiple exit paths.
- **D-04:** Element hover detection is top-level document only for v1. No shadow DOM or iframe traversal.
- **D-05:** Selection rectangle style: rounded border with semi-transparent tint overlay on the selected content. Reference: Gemini's inline selection UI.
- **D-06:** Element hover highlight uses the same rounded border + tint style as the rectangle selection. Consistent visual language across both modes.
- **D-07:** Color scheme: subtle light border with semi-transparent tint fill. Not a hard blue OS-style selection.
- **D-08:** Input bar appears inline near the selection -- below if there's room, above if the selection is near the bottom of the window. Smart positioning adapts to available space.
- **D-09:** Dark input bar matching toolbar aesthetic: dark background (~88% opacity), white text, rounded corners. Consistent with the existing Claw toolbar and the Gemini reference.
- **D-10:** Auto-expanding input: starts as single-line, grows taller as user types more lines (up to a max height). Compact by default.
- **D-11:** Enter to submit, Shift+Enter for new line. Standard chat/prompt convention.
- **D-12:** After submitting an instruction, selection and input disappear. Overlay returns to inactive state. Clean slate each time.
- **D-13:** No selection memory -- each selection is independent. No history, no ghost outlines.
- **D-14:** Concurrent edits allowed -- after submit, user can immediately make another selection without waiting for Claude to finish the previous edit.

### Claude's Discretion
- Exact border color and opacity values for the selection rectangle/highlight
- Crosshair cursor implementation (CSS cursor vs custom drawn)
- Exact positioning algorithm for the smart input bar placement
- DOM extraction depth and serialization format (structure, classes, IDs, text content, hierarchy)
- DPI-aware screenshot coordinate calculation (devicePixelRatio handling)
- How element hover detection communicates across the two-view boundary (executeJavaScript on siteView)

### Deferred Ideas (OUT OF SCOPE)
- Task progress UI showing multiple in-flight edits -- Phase 4 (CLAUD-03 status feedback)
- Claude subagent orchestration for concurrent edits -- Phase 4 architecture decision
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEL-01 | User can draw a freeform rectangle over any area of the website to select a region | Canvas-free rectangle drawing via absolute-positioned div + mousemove tracking in overlay renderer. Minimum 16x16px threshold per UI spec. |
| SEL-02 | User can click a single DOM element to select it (element highlights on hover) | Cross-view element detection: overlay captures mousemove, IPC to main, executeJavaScript(`document.elementFromPoint(x, y)`) on siteView, return bounding rect, overlay renders highlight div. |
| SEL-03 | Selected region/element is visually highlighted with a clear boundary indicator | CSS classes per UI spec: `rgba(138, 180, 248)` accent with varying opacity for drawing/committed/hover states, 6px border-radius. |
| SEL-04 | User can re-select the same or nearby area to continue editing in context | D-13: each selection independent. After submit, overlay returns to inactive. User activates selection mode again. Claude Code session context provides continuity. |
| CAP-01 | Screenshot of the selected region is captured as an image | `siteView.webContents.capturePage(rect)` returns NativeImage. Crop to selection bounds if needed. Output as PNG buffer via `.toPNG()`. |
| CAP-02 | DOM elements within the selected region are extracted | `siteView.webContents.executeJavaScript()` with a script that queries elements within the selection rect, serializes to JSON (tag, classes, id, textContent, hierarchy, computed styles subset). |
| CAP-03 | Screenshot coordinates are DPI-aware (correct on Retina/HiDPI displays) | Main process reads `screen.getPrimaryDisplay().scaleFactor` and multiplies CSS pixel coordinates before passing to `capturePage()`. NativeImage returned at device pixel resolution. See DPI handling section below. |
| INST-01 | After selection, an input field appears where the user can type their change instruction | Auto-expanding textarea in dark input bar, smart-positioned near selection per D-08/D-09/D-10. |
| INST-02 | User can submit the instruction to send it to Claude Code | Enter key submits (D-11). New IPC channel `overlay:submit-instruction` sends `{ instruction, screenshot, dom, bounds }` to main process. Phase 3 emits the event; Phase 4 handles the Claude Code integration. |
| INST-03 | Input field supports multi-line text for complex instructions | Shift+Enter for newline (D-11). textarea element with auto-expand logic (scrollHeight-based). Max height 160px per UI spec, then internal scroll. |
</phase_requirements>

## Standard Stack

### Core (all built-in -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron `webContents.capturePage()` | built-in (Electron 36) | Region screenshot | Accepts rect parameter, returns NativeImage. No external screenshot library needed. |
| Electron `NativeImage` | built-in (Electron 36) | Image processing | `.toPNG()`, `.crop()`, `.getSize()`. Eliminates need for sharp. |
| Electron `webContents.executeJavaScript()` | built-in (Electron 36) | DOM extraction | Runs JS in site view context, returns serializable JSON. |
| Electron `screen` module | built-in (Electron 36) | DPI detection | `getPrimaryDisplay().scaleFactor` for HiDPI coordinate math. |
| Electron IPC (`ipcMain.handle` / `ipcRenderer.invoke`) | built-in (Electron 36) | Cross-process communication | Typed request/response pattern established in Phase 2. |
| Vanilla CSS + TypeScript | project stack | Overlay UI | No framework needed for the small overlay surface area. Matches Phase 2 pattern. |

### No New Dependencies Required

Phase 3 introduces zero new npm packages. All functionality is built on Electron built-ins and vanilla web APIs. This is correct -- the overlay is a thin transparent HTML page with a small surface area. A framework or component library would be overhead.

**Installation:** None needed. All dependencies are already in `package.json` from Phase 2.

## Architecture Patterns

### Recommended Project Structure (Phase 3 additions)

```
src/
  main/
    window.ts          # EXTEND: no changes needed (setOverlayActive/Inactive already done)
    ipc-handlers.ts    # EXTEND: add capture-screenshot, extract-dom, submit-instruction handlers
    capture.ts         # NEW: screenshot capture logic (capturePage + DPI math)
    dom-extract.ts     # NEW: DOM extraction script builder + result types
    index.ts           # EXTEND: pass siteView to new handlers
  preload/
    overlay.ts         # EXTEND: add new IPC channels to contextBridge API
  renderer/
    overlay.html       # EXTEND: add element mode button, selection container, input bar HTML
    overlay.css        # EXTEND: add selection, highlight, input bar styles per UI spec
    overlay.ts         # REWRITE: full selection state machine, drawing, element detection, input bar logic
```

### Pattern 1: Selection State Machine

**What:** A finite state machine in the overlay renderer that manages all selection modes and transitions.
**When to use:** Any time you have multiple exclusive UI modes with defined transitions.

```typescript
type OverlayMode = 'inactive' | 'rect-idle' | 'rect-drawing' | 'rect-committed'
                 | 'elem-idle' | 'elem-hovering' | 'elem-committed';

interface SelectionState {
  mode: OverlayMode;
  // Rectangle selection data
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  // Element selection data
  hoveredRect: DOMRect | null;
  selectedRect: DOMRect | null;
  // Committed selection bounds (used for both modes)
  selectionBounds: { x: number; y: number; width: number; height: number } | null;
}

function transition(state: SelectionState, event: SelectionEvent): SelectionState {
  // Pure function: current state + event -> new state
  // Renderer re-renders based on new state
}
```

**Why:** The UI spec defines 7 distinct visual states across two modes. A state machine prevents impossible state combinations (e.g., drawing a rectangle while in element mode) and makes transitions explicit and testable.

### Pattern 2: Cross-View Element Detection via IPC Round-Trip

**What:** Overlay captures mouse position, sends to main process via IPC, main process runs `executeJavaScript` on site view to detect element at those coordinates, returns bounding rect to overlay for highlight rendering.
**When to use:** Any time the overlay needs to inspect the site view's DOM.

```typescript
// In overlay renderer (overlay.ts):
overlayEl.addEventListener('mousemove', async (e) => {
  if (state.mode !== 'elem-idle' && state.mode !== 'elem-hovering') return;
  // Throttle to ~60fps (requestAnimationFrame or 16ms debounce)
  const rect = await window.claw.getElementAtPoint(e.clientX, e.clientY);
  if (rect) {
    renderHighlight(rect);
    state.mode = 'elem-hovering';
    state.hoveredRect = rect;
  }
});

// In preload (overlay.ts):
getElementAtPoint: (x: number, y: number): Promise<DOMRect | null> =>
  ipcRenderer.invoke('overlay:get-element-at-point', x, y),

// In main process (ipc-handlers.ts):
ipcMain.handle('overlay:get-element-at-point', async (_event, x: number, y: number) => {
  const result = await components.siteView.webContents.executeJavaScript(`
    (function() {
      const el = document.elementFromPoint(${x}, ${y});
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
               tag: el.tagName.toLowerCase(), id: el.id, className: el.className };
    })()
  `);
  return result;
});
```

**Critical consideration:** The IPC round-trip introduces latency. On a fast machine this is ~1-5ms, but it means element highlights will lag slightly behind the cursor. Throttling mousemove to requestAnimationFrame cadence (16ms) prevents flooding the IPC channel while keeping highlights responsive.

### Pattern 3: DPI-Aware Screenshot Capture

**What:** Main process applies `scaleFactor` to CSS pixel coordinates before calling `capturePage()`.
**When to use:** Every screenshot capture operation.

```typescript
// In main process (capture.ts):
import { screen } from 'electron';

export async function captureRegion(
  siteView: WebContentsView,
  cssRect: { x: number; y: number; width: number; height: number }
): Promise<Buffer> {
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor;
  
  // capturePage historically requires device pixel coordinates
  // The rect must be scaled by devicePixelRatio
  const deviceRect = {
    x: Math.round(cssRect.x * scaleFactor),
    y: Math.round(cssRect.y * scaleFactor),
    width: Math.round(cssRect.width * scaleFactor),
    height: Math.round(cssRect.height * scaleFactor),
  };
  
  const image = await siteView.webContents.capturePage(deviceRect);
  return image.toPNG();
}
```

**IMPORTANT NOTE on DPI:** Electron's documentation does not explicitly state whether `capturePage(rect)` expects CSS/DIP pixels or device pixels. Historical issues (electron/electron#8314, fixed in 2021) showed that the coordinate system was inconsistent across versions. In modern Electron (32+), the behavior may have been normalized. **This must be validated empirically in Wave 0** by capturing a known region on a Retina display and comparing the output. The implementation should include a validation step:

1. Capture full page (no rect) and check `image.getSize()` vs window content bounds
2. If `getSize()` returns device pixels (e.g., 2560x1600 for a 1280x800 window at 2x), then `capturePage(rect)` likely expects device pixel coordinates
3. If `getSize()` returns CSS pixels, then rect should also be in CSS pixels

This is flagged as the primary technical risk for this phase.

### Pattern 4: DOM Extraction Script

**What:** A self-contained JavaScript function injected into the site view that finds all elements within a bounding rect and serializes their properties.
**When to use:** After selection is committed, before submitting to Claude.

```typescript
// In main process (dom-extract.ts):
export function buildDomExtractionScript(rect: {
  x: number; y: number; width: number; height: number;
}): string {
  return `
    (function() {
      const rect = { x: ${rect.x}, y: ${rect.y}, w: ${rect.width}, h: ${rect.height} };
      const elements = [];
      const allEls = document.querySelectorAll('*');
      
      for (const el of allEls) {
        const elRect = el.getBoundingClientRect();
        // Check if element overlaps with selection rect
        if (elRect.right < rect.x || elRect.left > rect.x + rect.w) continue;
        if (elRect.bottom < rect.y || elRect.top > rect.y + rect.h) continue;
        
        // Skip non-visible elements
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        
        elements.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || undefined,
          classes: el.className ? el.className.split(' ').filter(Boolean) : [],
          text: el.textContent?.trim().substring(0, 200) || undefined,
          bounds: {
            x: Math.round(elRect.x),
            y: Math.round(elRect.y),
            width: Math.round(elRect.width),
            height: Math.round(elRect.height),
          },
          // Include parent chain for hierarchy context
          path: getElementPath(el),
        });
      }
      
      function getElementPath(el) {
        const parts = [];
        let current = el;
        while (current && current !== document.body) {
          let selector = current.tagName.toLowerCase();
          if (current.id) selector += '#' + current.id;
          else if (current.className) {
            const cls = current.className.split(' ').filter(Boolean)[0];
            if (cls) selector += '.' + cls;
          }
          parts.unshift(selector);
          current = current.parentElement;
        }
        return parts.join(' > ');
      }
      
      return { elements, viewport: { width: window.innerWidth, height: window.innerHeight } };
    })()
  `;
}
```

**Key design decisions for DOM extraction:**
- Serialize as JSON (per CLAUDE.md key decision #4 -- "DOM context as serialized JSON, not HTML string")
- Include element path (CSS selector chain) for Claude to locate elements in source code
- Truncate text content to 200 chars to avoid huge payloads
- Skip invisible elements (display:none, visibility:hidden)
- Include bounding rects relative to viewport for positional context

### Pattern 5: Auto-Expanding Textarea

**What:** Vanilla JS textarea that grows as user types, up to a max height.
**When to use:** For the instruction input bar (D-10).

```typescript
// Set height to auto, then to scrollHeight
function autoExpand(textarea: HTMLTextAreaElement, maxHeight: number): void {
  textarea.style.height = 'auto';
  const newHeight = Math.min(textarea.scrollHeight, maxHeight);
  textarea.style.height = `${newHeight}px`;
}

// Listen to input events
textarea.addEventListener('input', () => autoExpand(textarea, 160));
```

### Anti-Patterns to Avoid

- **Do not return DOM elements from executeJavaScript.** DOM elements cannot cross IPC boundaries. Always serialize to plain objects/JSON. Returning a raw element will freeze the app.
- **Do not use pointer-events: none on the full overlay during element mode.** The overlay needs to capture mouse events to detect hover position. Instead, the overlay captures events and forwards coordinates to the site view via IPC.
- **Do not poll for element hover in setInterval.** Use mousemove events throttled to requestAnimationFrame cadence. Polling wastes CPU and produces jankier results.
- **Do not store screenshots as files.** Per CLAUDE.md key decision #3: "Screenshot as PNG buffer, not file." Keep as Buffer in memory, pass via IPC.
- **Do not use innerHTML for the instruction input.** Use a proper textarea element for accessibility, native keyboard behavior, and paste support.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Screenshot capture | Custom screenshot library or canvas capture | `webContents.capturePage(rect)` | Built-in, DPI-aware (after validation), returns NativeImage with crop/toPNG |
| Image format conversion | Manual PNG encoding | `NativeImage.toPNG()` | Built-in, handles color space, compression |
| DPI detection | `window.devicePixelRatio` in renderer | `screen.getPrimaryDisplay().scaleFactor` in main process | Main process has access to the screen module; renderer devicePixelRatio may not match display scaleFactor in all cases |
| Element hit testing | Custom quadtree or spatial index | `document.elementFromPoint()` | Browser-native, handles z-index, visibility, pointer-events correctly |
| Bounding rect calculation | Manual offset calculation | `element.getBoundingClientRect()` | Handles transforms, scroll, border-box correctly |
| IPC type safety | Manual type assertions | Typed contextBridge API (existing pattern) | Established in Phase 2, catches type errors at compile time |

## Common Pitfalls

### Pitfall 1: capturePage rect coordinate system ambiguity
**What goes wrong:** Screenshot captures the wrong region -- shifted, wrong size, or blank on HiDPI displays.
**Why it happens:** Electron docs do not explicitly state whether `capturePage(rect)` expects CSS/DIP pixels or device pixels. Historical bugs (electron/electron#8314) showed inconsistent behavior.
**How to avoid:** Validate empirically in Wave 0. Capture a known region on both 1x and 2x displays. Compare `image.getSize()` against expected dimensions. Build the capture function with a configurable `scaleFactor` multiplier so it can be adjusted based on test results.
**Warning signs:** Screenshots appear zoomed in, zoomed out, shifted, or are the wrong dimensions.

### Pitfall 2: executeJavaScript returning non-serializable data
**What goes wrong:** App freezes or throws when trying to return DOM elements, NodeLists, or circular objects from `executeJavaScript()`.
**Why it happens:** IPC serialization uses structured clone algorithm. DOM elements, functions, and circular references are not serializable.
**How to avoid:** Always wrap extraction in an IIFE that returns a plain JSON-serializable object. Test the return value with `JSON.stringify()` mentally before returning it.
**Warning signs:** Promise from executeJavaScript never resolves, or app becomes unresponsive.

### Pitfall 3: IPC flooding from mousemove during element hover detection
**What goes wrong:** UI becomes sluggish, highlight lags far behind cursor, main process CPU spikes.
**Why it happens:** mousemove fires at 60+ Hz. Each event triggers an IPC round-trip + executeJavaScript on the site view. Without throttling, hundreds of IPC messages queue up.
**How to avoid:** Throttle to one IPC call per animation frame (~16ms). Use `requestAnimationFrame` gate: set a flag on mousemove, process it in rAF callback, clear flag.
**Warning signs:** High CPU usage, visible highlight lag, jerky cursor movement.

### Pitfall 4: Overlay capturing mouse events when it should be transparent
**What goes wrong:** User cannot interact with their site (clicks go to overlay, not site).
**Why it happens:** Phase 2 solved this with the bounds toggle pattern (shrink overlay to 48x48 when inactive). But during selection mode, the overlay is full-window. After selection and submit, if the overlay doesn't shrink back, the site is blocked.
**How to avoid:** Always call `overlay:deactivate-selection` IPC after submit (D-12). The state machine must guarantee that submitting an instruction transitions back to inactive mode and shrinks the overlay.
**Warning signs:** User reports they can't click on their website after dismissing the selection.

### Pitfall 5: Input bar clipped by viewport edges
**What goes wrong:** Instruction input bar partially or fully outside the visible window area, making it unusable.
**Why it happens:** Smart positioning logic doesn't account for all edge cases (selection at top-left corner, very small window, etc.).
**How to avoid:** Implement the positioning algorithm from the UI spec with explicit viewport edge clamping: minimum 16px from any edge. Test with selections at all four corners and edges.
**Warning signs:** Input bar cut off, text not visible, submit button outside viewport.

### Pitfall 6: Selection rectangle off-by-one on overlay vs site alignment
**What goes wrong:** The selection rectangle drawn on the overlay does not align perfectly with the site content underneath.
**Why it happens:** The overlay WebContentsView and site WebContentsView have the same bounds (both set to full window in active mode), but CSS coordinate origins could differ if there are scrollbars, margins, or the overlay HTML has any default body margin.
**How to avoid:** Ensure overlay HTML/CSS has `margin: 0; padding: 0` on html and body (already done in Phase 2's overlay.css). Both views should have identical dimensions via `syncBounds()`. Test alignment by drawing a selection over a known pixel position.
**Warning signs:** Highlight appears shifted from the actual content underneath.

### Pitfall 7: Transparent overlay compositing artifacts
**What goes wrong:** Visual glitches where rendering compounds on top of itself (ghosting, darkening).
**Why it happens:** electron/electron#42335 -- transparent WebContentsView compositing bug introduced in Electron 31, fixed in Electron 32.
**How to avoid:** We are on Electron 36 where the fix is included. However, related issue #47351 (June 2025) reports that background doesn't cover existing views until pageload finishes, affecting Electron 35-37. Validate in Wave 0 by toggling overlay active/inactive rapidly and checking for artifacts.
**Warning signs:** Selection rectangle leaves ghost trails, toolbar darkens over time, resizing the window temporarily fixes display.

## Code Examples

### Rectangle Drawing (overlay renderer)
```typescript
// Source: Standard DOM event pattern for rubber-band selection
let drawing = false;
let startX = 0, startY = 0;

const selectionDiv = document.getElementById('claw-selection')!;

document.addEventListener('mousedown', (e) => {
  if (state.mode !== 'rect-idle') return;
  drawing = true;
  startX = e.clientX;
  startY = e.clientY;
  selectionDiv.style.display = 'block';
  state.mode = 'rect-drawing';
});

document.addEventListener('mousemove', (e) => {
  if (!drawing) return;
  const x = Math.min(startX, e.clientX);
  const y = Math.min(startY, e.clientY);
  const w = Math.abs(e.clientX - startX);
  const h = Math.abs(e.clientY - startY);
  selectionDiv.style.left = `${x}px`;
  selectionDiv.style.top = `${y}px`;
  selectionDiv.style.width = `${w}px`;
  selectionDiv.style.height = `${h}px`;
});

document.addEventListener('mouseup', (e) => {
  if (!drawing) return;
  drawing = false;
  const w = Math.abs(e.clientX - startX);
  const h = Math.abs(e.clientY - startY);
  if (w < 16 || h < 16) {
    // Too small -- ignore (per UI spec)
    selectionDiv.style.display = 'none';
    state.mode = 'rect-idle';
    return;
  }
  state.mode = 'rect-committed';
  state.selectionBounds = {
    x: Math.min(startX, e.clientX),
    y: Math.min(startY, e.clientY),
    width: w,
    height: h,
  };
  showInputBar(state.selectionBounds);
});
```

### Smart Input Bar Positioning
```typescript
// Source: UI spec D-08 positioning rules
function positionInputBar(
  inputBar: HTMLElement,
  selection: { x: number; y: number; width: number; height: number }
): void {
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const MIN_EDGE_MARGIN = 16;
  const SPACE_THRESHOLD = 80;
  const INPUT_GAP = 8; // gap between selection and input bar

  // Width: match selection width, clamped to [240, 480]
  const barWidth = Math.max(240, Math.min(480, selection.width));
  inputBar.style.width = `${barWidth}px`;

  // Horizontal: align to selection left, clamp to viewport
  let left = selection.x;
  if (left + barWidth > viewportWidth - MIN_EDGE_MARGIN) {
    left = viewportWidth - MIN_EDGE_MARGIN - barWidth;
  }
  if (left < MIN_EDGE_MARGIN) left = MIN_EDGE_MARGIN;
  inputBar.style.left = `${left}px`;

  // Vertical: prefer below, fall back to above
  const spaceBelow = viewportHeight - (selection.y + selection.height);
  const spaceAbove = selection.y;

  if (spaceBelow >= SPACE_THRESHOLD) {
    inputBar.style.top = `${selection.y + selection.height + INPUT_GAP}px`;
  } else if (spaceAbove >= SPACE_THRESHOLD) {
    // Position above: bottom of input bar = top of selection - gap
    // We need to know input bar height, so position and adjust
    inputBar.style.top = ''; // clear
    inputBar.style.bottom = `${viewportHeight - selection.y + INPUT_GAP}px`;
  } else {
    // Neither has enough space -- put below anyway
    inputBar.style.top = `${selection.y + selection.height + INPUT_GAP}px`;
  }
}
```

### Keyboard Shortcut Handling (Enter/Shift+Enter)
```typescript
// Source: UI spec D-11 keyboard contract
textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const instruction = textarea.value.trim();
    if (instruction) {
      submitInstruction(instruction);
    }
  }
  // Shift+Enter: default behavior (newline) -- no preventDefault
});

textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    cancelSelection();
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BrowserView for overlays | WebContentsView (BaseWindow) | Electron 30+ (BrowserView deprecated) | Phase 2 already uses the new API |
| `setIgnoreMouseEvents()` for click-through | Bounds toggle (shrink/expand overlay) | Phase 2 design decision | setIgnoreMouseEvents not available on WebContentsView; bounds toggle works |
| Manual DPI math in every call | `screen.getPrimaryDisplay().scaleFactor` | Electron 12+ | Centralized DPI detection in main process |
| HTML string for DOM context | Serialized JSON | CLAUDE.md design decision | Structured data is more useful for Claude Code than raw HTML |

**Deprecated/outdated:**
- `BrowserView`: Deprecated in Electron 30. Already using `WebContentsView`.
- `remote` module: Removed. All cross-process calls use explicit IPC (already established in Phase 2).

## Open Questions

1. **capturePage rect coordinate system on Electron 36**
   - What we know: Historical bugs (electron/electron#8314, #8586) showed confusion between CSS and device pixel coordinates. Fix merged for Electron 32.
   - What's unclear: Whether modern `capturePage(rect)` expects CSS pixels (and handles scaling internally) or device pixels (requiring manual multiplication by scaleFactor). Docs do not specify.
   - Recommendation: Wave 0 prototype task must capture a known region on a 2x display and compare output. Build `captureRegion()` with configurable scaling so it can adapt. Start with multiplying by scaleFactor (more commonly needed historically), and adjust if empirical testing shows otherwise.

2. **Transparent overlay compositing on Electron 36**
   - What we know: electron/electron#42335 fixed in Electron 32. Related issue #47351 (background cover timing) affects Electron 35-37.
   - What's unclear: Whether rapid overlay bounds toggling (active/inactive) triggers any compositing artifacts on Electron 36.
   - Recommendation: Wave 0 visual validation. Toggle overlay active/inactive rapidly, draw selections, check for ghost trails or darkening.

3. **Element hover detection latency**
   - What we know: IPC round-trip + executeJavaScript adds ~1-5ms per call. mousemove fires at 60+ Hz.
   - What's unclear: Whether the perceived latency is acceptable UX on slower machines or complex DOM trees.
   - Recommendation: Implement with requestAnimationFrame throttling. If latency is noticeable, add a CSS transition on the highlight element (the UI spec already specifies 80ms ease-out) which will mask the delay.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run tests/main/ --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEL-01 | Freeform rectangle drawing state transitions | unit | `npx vitest run tests/main/selection.test.ts -t "rectangle" -x` | Wave 0 |
| SEL-02 | Element detection IPC round-trip | unit | `npx vitest run tests/main/ipc-handlers.test.ts -t "element-at-point" -x` | Wave 0 |
| SEL-03 | Selection highlight CSS classes applied correctly | manual | Visual inspection in Electron dev mode | manual-only (CSS rendering) |
| SEL-04 | Re-selection after submit returns to inactive state | unit | `npx vitest run tests/main/selection.test.ts -t "re-select" -x` | Wave 0 |
| CAP-01 | Screenshot capture returns PNG buffer | unit | `npx vitest run tests/main/capture.test.ts -t "capture" -x` | Wave 0 |
| CAP-02 | DOM extraction returns serialized JSON | unit | `npx vitest run tests/main/dom-extract.test.ts -x` | Wave 0 |
| CAP-03 | DPI scaling applied to capture coordinates | unit | `npx vitest run tests/main/capture.test.ts -t "dpi" -x` | Wave 0 |
| INST-01 | Input bar appears after selection committed | unit | `npx vitest run tests/main/selection.test.ts -t "input-bar" -x` | Wave 0 |
| INST-02 | Submit instruction emits IPC event | unit | `npx vitest run tests/main/ipc-handlers.test.ts -t "submit" -x` | Wave 0 |
| INST-03 | Textarea supports multi-line (Shift+Enter) | manual | Manual keyboard test in Electron | manual-only (keyboard events in renderer) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/main/ --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/main/capture.test.ts` -- covers CAP-01, CAP-03 (mock capturePage, verify scaleFactor math)
- [ ] `tests/main/dom-extract.test.ts` -- covers CAP-02 (verify extraction script returns correct JSON structure)
- [ ] `tests/main/ipc-handlers.test.ts` -- covers SEL-02, INST-02 (extend existing test patterns from window.test.ts)
- [ ] `tests/main/selection.test.ts` -- covers SEL-01, SEL-04, INST-01 (state machine unit tests)

## Project Constraints (from CLAUDE.md)

- **Platform**: Electron for the browser window
- **Claude integration**: Spawns Claude Code CLI as subprocess
- **Dev server**: Must support localhost URLs only
- **Open source**: License and repo structure for community contributions
- **Screenshot as PNG buffer, not file** (Key Technical Decision #3)
- **DOM context as serialized JSON, not HTML string** (Key Technical Decision #4)
- **CLI spawns Electron, not the other way around** (Key Technical Decision #1)
- **Renderer loads user's localhost directly** (Key Technical Decision #2)
- **No Co-Authored-By lines in git commits** (memory directive)
- **Never create .env backup files** (global directive)
- **GSD workflow enforcement**: Use GSD commands for file changes
- **electron-vite** for build tooling (multi-entry: main/preload/renderer)
- **Typed IPC via contextBridge** pattern established in Phase 2

## Sources

### Primary (HIGH confidence)
- [Electron webContents API](https://www.electronjs.org/docs/latest/api/web-contents) -- capturePage, executeJavaScript documentation
- [Electron NativeImage API](https://www.electronjs.org/docs/latest/api/native-image) -- crop, toPNG, getSize, resize with scaleFactor parameter
- [Electron screen API](https://www.electronjs.org/docs/latest/api/screen) -- getPrimaryDisplay, scaleFactor, DIP conversion methods
- [MDN document.elementFromPoint()](https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint) -- element detection API
- [MDN document.elementsFromPoint()](https://developer.mozilla.org/en-US/docs/Web/API/Document/elementsFromPoint) -- multi-element detection
- [MDN Element.getBoundingClientRect()](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) -- element bounds
- Existing codebase: `src/main/window.ts`, `src/main/ipc-handlers.ts`, `src/preload/overlay.ts`, `src/renderer/overlay.ts` -- Phase 2 patterns

### Secondary (MEDIUM confidence)
- [electron/electron#42335](https://github.com/electron/electron/issues/42335) -- Transparent WebContentsView compositing bug, closed as fixed for Electron 32
- [electron/electron#8314](https://github.com/electron/electron/issues/8314) -- capturePage scaleFactor bug, closed as completed
- [CSS-Tricks: Auto-Growing Textareas](https://css-tricks.com/the-cleanest-trick-for-autogrowing-textareas/) -- scrollHeight-based auto-expand pattern
- [Go Make Things: Auto-expand textarea](https://gomakethings.com/automatically-expand-a-textarea-as-the-user-types-using-vanilla-javascript/) -- vanilla JS implementation

### Tertiary (LOW confidence)
- [electron/electron#47351](https://github.com/electron/electron/issues/47351) -- WebContentsView background doesn't cover existing views until pageload finishes, affects Electron 35-37. Status unclear for Electron 36. Needs validation.
- capturePage rect coordinate system (CSS vs device pixels) in Electron 36 -- no definitive documentation found. Must validate empirically.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all built-in Electron APIs, no new dependencies, well-documented
- Architecture: HIGH -- extends established Phase 2 patterns (IPC, contextBridge, overlay renderer)
- Selection drawing: HIGH -- standard DOM event patterns (mousedown/mousemove/mouseup), well-understood
- Element detection: MEDIUM -- cross-view IPC round-trip is sound but latency needs empirical validation
- DPI/Screenshot capture: MEDIUM -- API exists and works, but coordinate system needs empirical validation on HiDPI
- DOM extraction: HIGH -- executeJavaScript with serializable return is well-established pattern
- Compositing: MEDIUM -- fix merged for Electron 32, related issue for 35-37 needs validation
- Pitfalls: HIGH -- well-documented historical issues with clear mitigation strategies

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (30 days -- stable domain, Electron 36 is current)
