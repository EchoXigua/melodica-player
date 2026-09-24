import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ command }) => ({
  root: 'src/renderer',
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'local-csp',
      transformIndexHtml(html) {
        return command === 'serve'
          ? html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
          : html.replace("connect-src 'self' ws://127.0.0.1:*", "connect-src 'none'");
      },
    },
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { outDir: '../../build/renderer', emptyOutDir: true, chunkSizeWarningLimit: 650 },
}));
