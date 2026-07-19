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
        // so lazily fetched data works offline too. Exclude the 1.7 MB H.264
        // encoder — it is only needed for MP4 export and is fetched on demand.
        globPatterns: ['**/*.{js,css,html,svg,json,webp}'],
        // Heavy / on-demand only: H.264 encoder (~1.7 MB). Unused hsluv kept on
        // disk for parity with Grafema vendor set but not precached.
        globIgnores: [
          '**/h264-mp4-encoder.web.js',
          '**/hsluv.min.js',
          '**/workbox-*.js',
        ],
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
