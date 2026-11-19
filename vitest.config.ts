import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'test-service-worker-registration',
      resolveId: (id) => id === 'virtual:pwa-register' ? '\0virtual:pwa-register' : undefined,
      load: (id) => id === '\0virtual:pwa-register'
        ? 'export const registerSW = () => () => Promise.resolve();'
        : undefined,
    },
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        'src/**/*.d.ts',
        'src/**/*.check.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
    globals: true,
    css: true,
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});
