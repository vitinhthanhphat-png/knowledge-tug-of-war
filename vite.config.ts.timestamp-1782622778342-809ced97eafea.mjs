// vite.config.ts
import { defineConfig } from "file:///D:/AI%20APP/DauTruongKienThuc/knowledge-tug-of-war/node_modules/vite/dist/node/index.js";
import preact from "file:///D:/AI%20APP/DauTruongKienThuc/knowledge-tug-of-war/node_modules/@preact/preset-vite/dist/esm/index.mjs";
var vite_config_default = defineConfig({
  plugins: [preact()],
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 10485760,
    sourcemap: false,
    emptyOutDir: true,
    lib: {
      entry: "src/main.tsx",
      name: "KnowledgeTugOfWar",
      formats: ["iife"],
      fileName: () => "knowledge-tug-of-war.js"
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
      react: "preact/compat",
      "react-dom": "preact/compat"
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxBSSBBUFBcXFxcRGF1VHJ1b25nS2llblRodWNcXFxca25vd2xlZGdlLXR1Zy1vZi13YXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXEFJIEFQUFxcXFxEYXVUcnVvbmdLaWVuVGh1Y1xcXFxrbm93bGVkZ2UtdHVnLW9mLXdhclxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovQUklMjBBUFAvRGF1VHJ1b25nS2llblRodWMva25vd2xlZGdlLXR1Zy1vZi13YXIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCBwcmVhY3QgZnJvbSAnQHByZWFjdC9wcmVzZXQtdml0ZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtwcmVhY3QoKV0sXG4gIGJ1aWxkOiB7XG4gICAgY3NzQ29kZVNwbGl0OiBmYWxzZSxcbiAgICBhc3NldHNJbmxpbmVMaW1pdDogMTA0ODU3NjAsXG4gICAgc291cmNlbWFwOiBmYWxzZSxcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgICBsaWI6IHtcbiAgICAgIGVudHJ5OiAnc3JjL21haW4udHN4JyxcbiAgICAgIG5hbWU6ICdLbm93bGVkZ2VUdWdPZldhcicsXG4gICAgICBmb3JtYXRzOiBbJ2lpZmUnXSxcbiAgICAgIGZpbGVOYW1lOiAoKSA9PiAna25vd2xlZGdlLXR1Zy1vZi13YXIuanMnLFxuICAgIH0sXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgZXh0ZXJuYWw6IFtdLFxuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIGV4dGVuZDogdHJ1ZVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICByZWFjdDogJ3ByZWFjdC9jb21wYXQnLFxuICAgICAgJ3JlYWN0LWRvbSc6ICdwcmVhY3QvY29tcGF0JyxcbiAgICB9XG4gIH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE0VSxTQUFTLG9CQUFvQjtBQUN6VyxPQUFPLFlBQVk7QUFFbkIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE9BQU8sQ0FBQztBQUFBLEVBQ2xCLE9BQU87QUFBQSxJQUNMLGNBQWM7QUFBQSxJQUNkLG1CQUFtQjtBQUFBLElBQ25CLFdBQVc7QUFBQSxJQUNYLGFBQWE7QUFBQSxJQUNiLEtBQUs7QUFBQSxNQUNILE9BQU87QUFBQSxNQUNQLE1BQU07QUFBQSxNQUNOLFNBQVMsQ0FBQyxNQUFNO0FBQUEsTUFDaEIsVUFBVSxNQUFNO0FBQUEsSUFDbEI7QUFBQSxJQUNBLGVBQWU7QUFBQSxNQUNiLFVBQVUsQ0FBQztBQUFBLE1BQ1gsUUFBUTtBQUFBLFFBQ04sUUFBUTtBQUFBLE1BQ1Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
