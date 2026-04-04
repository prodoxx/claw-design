/**
 * DOM extraction types.
 * Per CLAUDE.md Key Decision #4: DOM context as serialized JSON, not HTML string.
 */
export interface ExtractedElement {
  tag: string;
  id?: string;
  classes: string[];
  text?: string;
  bounds: { x: number; y: number; width: number; height: number };
  path: string; // CSS selector chain: "div.container > section#main > p.intro"
}

export interface DomExtractionResult {
  elements: ExtractedElement[];
  viewport: { width: number; height: number };
}

/**
 * Build a self-contained JavaScript script that, when executed in the site view
 * via webContents.executeJavaScript(), finds all visible elements within the
 * given bounding rect and serializes their properties to JSON-safe objects.
 *
 * The script returns a DomExtractionResult-shaped object.
 *
 * Per D-04: top-level document only, no shadow DOM or iframe traversal.
 *
 * Uses var and old-style functions (not arrow functions, not const/let)
 * to maximize compatibility with any user site's JavaScript engine mode.
 * The IIFE pattern ensures no variable leaks.
 */
export function buildDomExtractionScript(rect: {
  x: number;
  y: number;
  width: number;
  height: number;
}): string {
  return `(function() {
  var rect = { x: ${rect.x}, y: ${rect.y}, w: ${rect.width}, h: ${rect.height} };
  var elements = [];
  var allEls = document.querySelectorAll('*');

  function getElementPath(el) {
    var parts = [];
    var current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      var selector = current.tagName.toLowerCase();
      if (current.id) {
        selector += '#' + current.id;
      } else if (current.className && typeof current.className === 'string') {
        var cls = current.className.split(' ').filter(function(c) { return c.length > 0; })[0];
        if (cls) selector += '.' + cls;
      }
      parts.unshift(selector);
      current = current.parentElement;
    }
    return parts.join(' > ');
  }

  for (var i = 0; i < allEls.length; i++) {
    var el = allEls[i];
    var elRect = el.getBoundingClientRect();

    // Check overlap with selection rect
    if (elRect.right < rect.x || elRect.left > rect.x + rect.w) continue;
    if (elRect.bottom < rect.y || elRect.top > rect.y + rect.h) continue;

    // Skip invisible elements
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;

    var textContent = el.textContent ? el.textContent.trim().substring(0, 200) : undefined;

    elements.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      classes: el.className && typeof el.className === 'string'
        ? el.className.split(' ').filter(function(c) { return c.length > 0; })
        : [],
      text: textContent || undefined,
      bounds: {
        x: Math.round(elRect.x),
        y: Math.round(elRect.y),
        width: Math.round(elRect.width),
        height: Math.round(elRect.height)
      },
      path: getElementPath(el)
    });
  }

  return {
    elements: elements,
    viewport: { width: window.innerWidth, height: window.innerHeight }
  };
})()`;
}
