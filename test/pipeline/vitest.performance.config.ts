export default {
  resolve: { alias: { '@': new URL('../../src', import.meta.url).pathname } },
  esbuild: { jsx: 'automatic' },
  test: { include: ['test/pipeline/tabs-performance.test.tsx', 'test/pipeline/card-construction.test.tsx', 'test/pipeline/report-summary-batch.test.ts'] },
};