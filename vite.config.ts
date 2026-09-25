import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// HomeKind is served from the Capacitor bundle (capacitor://localhost) and, in
// development, from a plain browser. Relative asset paths keep both working.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
});
