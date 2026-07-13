import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5621, host: true },
  preview: { port: 5621 },
});
