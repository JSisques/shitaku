// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://jsisques.github.io',
  base: '/shitaku/',
  integrations: [
    starlight({
      title: 'shitaku',
      defaultLocale: 'en',
      locales: {
        en: { label: 'English', lang: 'en' },
        es: { label: 'Español', lang: 'es' },
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/JSisques/shitaku',
        },
      ],
      sidebar: [
        {
          label: 'Start',
          translations: { es: 'Inicio' },
          items: [
            { label: 'Home', translations: { es: 'Inicio' }, slug: 'index' },
            {
              label: 'Getting started',
              translations: { es: 'Primeros pasos' },
              slug: 'getting-started',
            },
          ],
        },
        {
          label: 'CLI',
          translations: { es: 'CLI' },
          items: [
            { label: 'Commands', translations: { es: 'Comandos' }, slug: 'cli/commands' },
            { label: 'Flags', translations: { es: 'Flags' }, slug: 'cli/flags' },
            { label: 'Exit codes', translations: { es: 'Códigos de salida' }, slug: 'cli/exit-codes' },
          ],
        },
        {
          label: 'Security',
          translations: { es: 'Seguridad' },
          items: [{ label: 'Security', translations: { es: 'Seguridad' }, slug: 'security' }],
        },
        {
          label: 'Catalog',
          translations: { es: 'Catálogo' },
          items: [{ autogenerate: { directory: 'catalog' } }],
        },
      ],
    }),
  ],
});
