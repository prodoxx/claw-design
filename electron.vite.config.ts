import { defineConfig } from 'electron-vite';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: 'src/main/index.ts',
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          overlay: resolve(__dirname, 'src/preload/overlay.ts'),
          sidebar: resolve(__dirname, 'src/preload/sidebar.ts'),
        },
        output: {
          format: 'cjs',
        },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: {
          overlay: resolve(__dirname, 'src/renderer/overlay.html'),
          sidebar: resolve(__dirname, 'src/renderer/sidebar.html'),
        },
      },
    },
  },
});
