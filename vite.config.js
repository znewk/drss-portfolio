import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — относительные пути, чтобы сборка работала на GitHub Pages
// по адресу https://<user>.github.io/<repo>/ без дополнительной настройки.
export default defineConfig({
  plugins: [react()],
  base: './',
});
