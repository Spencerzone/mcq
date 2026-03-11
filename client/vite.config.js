import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/mcq/',
  server: {
    port: 5173,
  },
  root: '.'
});
