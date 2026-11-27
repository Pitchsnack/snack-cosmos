import { useQueryClient } from '@tanstack/react-query';
import { usePersona } from './use-marketplace';
import { prefetchPipelinePage } from '@/lib/pipeline-queries';
import { PIPELINE_PAGES } from '@/lib/pipeline-pages';

export function usePipelinePrefetch() {
  const qc = useQueryClient();
  const { persona } = usePersona();
  return (path: string) => {
    if (persona === 'advisor') return;
    const page = PIPELINE_PAGES.find(([key]) => path.endsWith(`/${key}`))?.[0];
    if (page) void prefetchPipelinePage(qc, persona, page);
  };
}