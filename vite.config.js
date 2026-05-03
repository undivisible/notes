import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  plugins: [
    UnoCSS(),
    svelte(),
  ],
  base: process.env.GITHUB_PAGES === 'true' ? `/${process.env.GITHUB_REPO_NAME}/` : '/',
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
  },
})
