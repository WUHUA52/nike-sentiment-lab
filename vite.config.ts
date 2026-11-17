import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths, so the build works at a domain root and under
  // a sub-path such as https://<user>.github.io/nike-sentiment-lab/.
  base: './',
  plugins: [react()],
})
