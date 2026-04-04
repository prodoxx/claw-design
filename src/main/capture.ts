import { screen } from 'electron';
import type { WebContentsView } from 'electron';

export interface CSSRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute device pixel rect from CSS pixel rect.
 * Exported for unit testing without Electron mocks.
 */
export function computeDeviceRect(cssRect: CSSRect, scaleFactor: number): CSSRect {
  return {
    x: Math.round(cssRect.x * scaleFactor),
    y: Math.round(cssRect.y * scaleFactor),
    width: Math.round(cssRect.width * scaleFactor),
    height: Math.round(cssRect.height * scaleFactor),
  };
}

/**
 * Capture a region of the site view as a PNG buffer.
 *
 * capturePage() takes DIP (CSS pixel) coordinates and returns a
 * NativeImage at device pixel resolution automatically.
 *
 * Per CLAUDE.md Key Decision #3: returns PNG buffer, not file path.
 */
export async function captureRegion(
  siteView: WebContentsView,
  cssRect: CSSRect,
): Promise<Buffer> {
  // Clamp to non-negative and ensure minimum 1x1 size
  const rect = {
    x: Math.max(0, Math.round(cssRect.x)),
    y: Math.max(0, Math.round(cssRect.y)),
    width: Math.max(1, Math.round(cssRect.width)),
    height: Math.max(1, Math.round(cssRect.height)),
  };

  const image = await siteView.webContents.capturePage(rect);
  return image.toPNG();
}
