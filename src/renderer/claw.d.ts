import type { ClawOverlayAPI } from '../preload/overlay';

declare global {
  interface Window {
    claw: ClawOverlayAPI;
  }
}
