import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { listPipeline, saveStageChoice } from '@/lib/pipeline.functions';
import { choiceSaveError, pipelineChoiceCache, type ChoiceInput } from '@/lib/pipeline-choice-cache';

export function usePipelineChoice(th: boolean) {
  const cache = pipelineChoiceCache(useQueryClient());
  const save = useServerFn(saveStageChoice), read = useServerFn(listPipeline);
  const mutation = useMutation({
    mutationFn: (op: ReturnType<typeof cache.begin>) => cache.run(op, input => save({ data: input })),
    onError: error => toast.error(choiceSaveError(error, th ? 'บันทึกตัวเลือกไม่สำเร็จ กรุณาลองอีกครั้ง' : "Couldn't save your choice. Please try again.")),
    onSettled: (_data, _error, op) => {
      void cache.settle(op.input, async () => (await read({ data: { as: op.input.side, id: op.input.id } }))[0] ?? null);
    },
    retry: false,
  });
  return (input: ChoiceInput) => mutation.mutate(cache.begin(input));
}