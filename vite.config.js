import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

function htmlPartialsAndCopyPlugin() {
  return {
    name: 'html-partials-and-copy',
    transformIndexHtml(html) {
      return html.replace(/<!--#include\s+file="([^"]+)"-->/g, (match, filepath) => {
        const fullPath = path.resolve(process.cwd(), filepath);
        try {
          return fs.readFileSync(fullPath, 'utf-8');
        } catch {
          console.error(`Could not read partial: ${fullPath}`);
          return match;
        }
      });
    }
  };
}

export default defineConfig({
  base: '/divix/',
  server: {
    port: 3000,
  },
  // lightningcss keeps both -webkit-backdrop-filter and the standard property
  // (esbuild's CSS minifier drops the standard one — see grafema history).
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      targets: {
        safari: 15 << 16,
        chrome: 90 << 16,
      },
    },
  },
  build: {
    outDir: 'dist',
    cssMinify: 'lightningcss',
  },
  plugins: [
    htmlPartialsAndCopyPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        suppressWarnings: true,
      },
      workbox: {
        // Include workspace assets (presets/palettes JSON, mask/default images)
        // so lazily fetched data works offline too.
        globPatterns: ['**/*.{js,css,html,svg,json,webp}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'Divix Design Studio',
        short_name: 'Divix',
        description: 'Generative graphics studio: Divix, Difuso, Bandada, Sondeo, Clon',
        theme_color: '#f4f4f4',
        background_color: '#f4f4f4',
        display: 'standalone',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
});
