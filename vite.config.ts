import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@ffmpeg/core'],
    },
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    build: {
      minify: 'esbuild',
      cssMinify: true,
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Lazy chunk heavy libraries to keep initial page load weight well under 1.5 MB
            if (id.includes('node_modules/three')) {
              return 'vendor-three';
            }
            if (id.includes('node_modules/jspdf')) {
              return 'vendor-jspdf';
            }
            if (id.includes('node_modules/pdfjs-dist')) {
              return 'vendor-pdfjs';
            }
            if (id.includes('node_modules/mammoth')) {
              return 'vendor-mammoth';
            }
            if (id.includes('node_modules/@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-lucide';
            }
            if (
              id.includes('node_modules/@vidstack') ||
              id.includes('node_modules/vidstack') ||
              id.includes('node_modules/media-captions') ||
              id.includes('node_modules/media-icons')
            ) {
              return 'vendor-vidstack';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio. Keeping hmr: false prevents port 24678 WebSocket collisions on restarts.
      hmr: false,
      watch: null,
    },
  };
});
