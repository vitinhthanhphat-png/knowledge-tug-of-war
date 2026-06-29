import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 10485760,
    sourcemap: false,
    emptyOutDir: false,
    lib: {
      entry: 'src/main.tsx',
      name: 'KnowledgeTugOfWar',
      formats: ['iife'],
      fileName: () => 'knowledge-tug-of-war.js',
    },
    rollupOptions: {
      external: [],
      output: {
        extend: true
      }
    }
  },
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
    }
  }
});
