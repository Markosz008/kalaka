import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function copyMaplibreWorkerPlugin() {
  return {
    name: 'copy-maplibre-worker',
    closeBundle() {
      const srcDir = path.resolve('node_modules/maplibre-gl/dist');
      const destDir = path.resolve('dist/assets');
      fs.mkdirSync(destDir, { recursive: true });
      if (fs.existsSync(srcDir)) {
        for (const file of fs.readdirSync(srcDir)) {
          if (file.endsWith('.mjs') || file.endsWith('.js')) {
            fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
          }
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), copyMaplibreWorkerPlugin()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-maplibre': ['maplibre-gl']
        }
      }
    }
  }
});
