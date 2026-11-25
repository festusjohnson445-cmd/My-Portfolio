import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

function buildOriginHtmlPlugin() {
  const DEFAULT_BUILD_ORIGIN =
    'https://ais-pre-fdpin4htltbxhzclxg3rsw-114689153952.europe-west2.run.app';
  const rawEnvOrigin =
    process.env.APP_URL ||
    process.env.SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const resolvedOrigin = rawEnvOrigin.trim().replace(/\/+$/, '');
  return {
    name: 'fesline-build-origin-seo',
    transformIndexHtml(html: string) {
      if (!resolvedOrigin) return html;
      return html.split(DEFAULT_BUILD_ORIGIN).join(resolvedOrigin);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), buildOriginHtmlPlugin()],
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
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('node_modules/three')) {
              return 'vendor-three';
            }
            if (id.includes('node_modules/jspdf')) {
              return 'vendor-jspdf';
            }
            if (id.includes('node_modules/html2canvas')) {
              return 'vendor-html2canvas';
            }
            if (id.includes('node_modules/pdfjs-dist')) {
              return 'vendor-pdfjs';
            }
            if (id.includes('node_modules/mammoth') || id.includes('node_modules/jszip')) {
              return 'vendor-docs';
            }
            if (id.includes('node_modules/xlsx')) {
              return 'vendor-xlsx';
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
