import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      '.localdb/**',
      '.data/**',
      'next-env.d.ts',
      'tsconfig.tsbuildinfo',
    ],
  },
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      // The rule looks for pages/_document.js; this project is App Router only,
      // and app/layout.tsx loads the fonts once for every route.
      '@next/next/no-page-custom-font': 'off',
    },
  },
];

export default config;
