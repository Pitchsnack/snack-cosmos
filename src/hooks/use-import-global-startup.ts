import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { importGlobalStartup } from "@/lib/api-gateway/global-startups";

export function useImportGlobalStartup() {
  const fn = useServerFn(importGlobalStartup);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      globalId: string;
      owningAgentUserId: string;
      owningAiAgentId: string;
    }) => fn({ data: input }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["startups"] });
      qc.invalidateQueries({ queryKey: ["global-startups"] });
      qc.invalidateQueries({ queryKey: ["global-startup-imports", vars.globalId] });
    },
  });
}
