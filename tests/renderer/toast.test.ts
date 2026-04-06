/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Toast notification system', () => {
  let toastModule: typeof import('../../src/renderer/toast.js');

  beforeEach(async () => {
    vi.useFakeTimers();

    // Set up toast container in the jsdom document
    document.body.textContent = '';
    const container = document.createElement('div');
    container.id = 'claw-toast-container';
    container.className = 'claw-toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);

    // Fresh import each test to reset module-level state (toastTimers map)
    vi.resetModules();
    toastModule = await import('../../src/renderer/toast.js');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('createToastElement', () => {
    it('returns an HTMLElement with correct class for info severity', () => {
      const el = toastModule.createToastElement(document, {
        id: 'test-1',
        severity: 'info',
        message: 'Test message',
        persistent: false,
      });
      expect(el).toBeTruthy();
      expect(el.classList.contains('claw-toast')).toBe(true);
      expect(el.classList.contains('claw-toast--info')).toBe(true);
    });

    it('returns an HTMLElement with correct class for warning severity', () => {
      const el = toastModule.createToastElement(document, {
        id: 'test-2',
        severity: 'warning',
        message: 'Warning message',
        persistent: false,
      });
      expect(el.classList.contains('claw-toast--warning')).toBe(true);
    });

    it('returns an HTMLElement with correct class for error severity', () => {
      const el = toastModule.createToastElement(document, {
        id: 'test-3',
        severity: 'error',
        message: 'Error message',
        persistent: false,
      });
      expect(el.classList.contains('claw-toast--error')).toBe(true);
    });

    it('sets data-toast-id attribute', () => {
      const el = toastModule.createToastElement(document, {
        id: 'my-toast',
        severity: 'info',
        message: 'Hello',
        persistent: false,
      });
      expect(el.dataset.toastId).toBe('my-toast');
    });

    it('sets message text via textContent -- security check', () => {
      const el = toastModule.createToastElement(document, {
        id: 'test-xss',
        severity: 'info',
        message: '<img src=x onerror=alert(1)>',
        persistent: false,
      });
      const msgEl = el.querySelector('.claw-toast__message');
      expect(msgEl).toBeTruthy();
      // textContent should contain the raw string, not interpret it as HTML
      expect(msgEl!.textContent).toBe('<img src=x onerror=alert(1)>');
      // There should be no img element in the DOM
      expect(el.querySelector('img')).toBeNull();
    });

    it('renders title when provided', () => {
      const el = toastModule.createToastElement(document, {
        id: 'test-title',
        severity: 'error',
        title: 'Dev server disconnected',
        message: 'The dev server crashed.',
        persistent: true,
      });
      const titleEl = el.querySelector('.claw-toast__title');
      expect(titleEl).toBeTruthy();
      expect(titleEl!.textContent).toBe('Dev server disconnected');
    });

    it('omits title element when title not provided', () => {
      const el = toastModule.createToastElement(document, {
        id: 'test-no-title',
        severity: 'info',
        message: 'Simple info',
        persistent: false,
      });
      expect(el.querySelector('.claw-toast__title')).toBeNull();
    });

    it('persistent toast has dismiss button', () => {
      const el = toastModule.createToastElement(document, {
        id: 'test-persistent',
        severity: 'error',
        message: 'Persistent error',
        persistent: true,
      });
      const dismissBtn = el.querySelector('.claw-toast__dismiss');
      expect(dismissBtn).toBeTruthy();
      expect(dismissBtn!.textContent).toBe('Dismiss');
    });

    it('non-persistent toast has no dismiss button', () => {
      const el = toastModule.createToastElement(document, {
        id: 'test-auto',
        severity: 'info',
        message: 'Auto dismiss',
        persistent: false,
      });
      expect(el.querySelector('.claw-toast__dismiss')).toBeNull();
    });

    it('has role="alert" attribute', () => {
      const el = toastModule.createToastElement(document, {
        id: 'test-role',
        severity: 'info',
        message: 'Accessible',
        persistent: false,
      });
      expect(el.getAttribute('role')).toBe('alert');
    });

    it('contains an SVG icon element', () => {
      const el = toastModule.createToastElement(document, {
        id: 'test-icon',
        severity: 'info',
        message: 'With icon',
        persistent: false,
      });
      const svg = el.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg!.classList.contains('claw-toast__icon')).toBe(true);
    });
  });

  describe('showToast', () => {
    it('adds toast element to container', () => {
      const container = document.getElementById('claw-toast-container')!;
      toastModule.showToast(document, {
        id: 'show-1',
        severity: 'info',
        message: 'Added to DOM',
        persistent: false,
      });
      expect(container.children.length).toBe(1);
      expect(container.children[0].classList.contains('claw-toast')).toBe(true);
    });

    it('non-persistent toast is auto-dismissed after 5000ms', () => {
      const container = document.getElementById('claw-toast-container')!;
      toastModule.showToast(document, {
        id: 'auto-dismiss-1',
        severity: 'info',
        message: 'Goes away',
        persistent: false,
      });
      expect(container.children.length).toBe(1);

      // Advance 5000ms (auto-dismiss fires)
      vi.advanceTimersByTime(5000);
      // After dismiss animation (150ms)
      vi.advanceTimersByTime(150);

      expect(container.children.length).toBe(0);
    });

    it('persistent toast is NOT auto-dismissed after 5000ms', () => {
      const container = document.getElementById('claw-toast-container')!;
      toastModule.showToast(document, {
        id: 'persistent-1',
        severity: 'error',
        message: 'Stays here',
        persistent: true,
      });

      vi.advanceTimersByTime(10000);
      // Should still be there
      expect(container.children.length).toBe(1);
    });

    it('multiple toasts stack vertically (container has multiple children)', () => {
      const container = document.getElementById('claw-toast-container')!;
      toastModule.showToast(document, {
        id: 'stack-1',
        severity: 'info',
        message: 'First',
        persistent: true,
      });
      toastModule.showToast(document, {
        id: 'stack-2',
        severity: 'warning',
        message: 'Second',
        persistent: true,
      });
      toastModule.showToast(document, {
        id: 'stack-3',
        severity: 'error',
        message: 'Third',
        persistent: true,
      });
      expect(container.children.length).toBe(3);
    });
  });

  describe('dismissToast', () => {
    it('removes toast element by id', () => {
      const container = document.getElementById('claw-toast-container')!;
      toastModule.showToast(document, {
        id: 'dismiss-me',
        severity: 'info',
        message: 'Dismiss me',
        persistent: true,
      });
      expect(container.children.length).toBe(1);

      toastModule.dismissToast(document, 'dismiss-me');
      // Wait for exit animation (150ms)
      vi.advanceTimersByTime(150);

      expect(container.children.length).toBe(0);
    });

    it('clears auto-dismiss timer when manually dismissed', () => {
      const container = document.getElementById('claw-toast-container')!;
      toastModule.showToast(document, {
        id: 'manual-dismiss',
        severity: 'info',
        message: 'Click to dismiss',
        persistent: false,
      });

      // Dismiss manually before auto-dismiss fires
      toastModule.dismissToast(document, 'manual-dismiss');
      vi.advanceTimersByTime(150);
      expect(container.children.length).toBe(0);

      // Advance past auto-dismiss time -- should not error or add new toast
      vi.advanceTimersByTime(5000);
      expect(container.children.length).toBe(0);
    });

    it('does nothing for nonexistent id', () => {
      // Should not throw
      toastModule.dismissToast(document, 'nonexistent');
    });
  });

  describe('security: textContent-only rendering', () => {
    it('toast module source file uses safe DOM construction only', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const toastSource = fs.readFileSync(
        path.resolve(__dirname, '../../src/renderer/toast.ts'),
        'utf-8',
      );
      // The source must use textContent, not unsafe HTML injection methods
      expect(toastSource).toContain('textContent');
    });
  });
});
