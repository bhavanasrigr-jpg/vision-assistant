import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true'
    ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] || 'vision-assistant'}/`
    : '/',
  plugins: [react()],
  server: { port: 5173 },
});
