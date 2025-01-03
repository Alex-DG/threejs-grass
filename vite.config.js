import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'

export default defineConfig({
  plugins: [
    glsl({
      include: '**/*.glsl', // Simplify include pattern
      defaultExtension: 'glsl',
      compress: false,
    }),
  ],
})
