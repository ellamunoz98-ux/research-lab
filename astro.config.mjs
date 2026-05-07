// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://research.example.com',
  integrations: [mdx(), react()],
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['echarts', 'echarts-for-react'],
    },
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark-dimmed',
      wrap: true,
    },
  },
});
