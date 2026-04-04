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
 * Per CAP-03: applies display scaleFactor to CSS pixel coordinates
 * before calling capturePage(). capturePage() returns a NativeImage
 * at device pixel resolution.
 *
 * Per CLAUDE.md Key Decision #3: returns PNG buffer, not file path.
 */
export async function captureRegion(
  siteView: WebContentsView,
  cssRect: CSSRect,
): Promise<Buffer> {
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor;
  const deviceRect = computeDeviceRect(cssRect, scaleFactor);

  const image = await siteView.webContents.capturePage(deviceRect);
  return image.toPNG();
}
