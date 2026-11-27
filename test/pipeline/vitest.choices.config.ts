export default {
  resolve: { alias: { '@': new URL('../../src', import.meta.url).pathname } },
  esbuild: { jsx: 'automatic' },
  test: { include: ['test/pipeline/choice-cache.test.ts', 'test/pipeline/choice-controls.test.tsx', 'test/pipeline/choice-read.test.ts'] },
};