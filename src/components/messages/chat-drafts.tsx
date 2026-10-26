import { createContext, useContext, useRef, type ReactNode } from 'react';

export type ChatDraft = { text: string; files: File[] };
export function draftKey(side: 'seller' | 'buyer', pipelineId: string) { return `${side}:p:${pipelineId}`; }
export function saveDraft(drafts: Map<string, ChatDraft>, key: string, draft: ChatDraft) {
  if (!draft.text && !draft.files.length) drafts.delete(key);
  else drafts.set(key, draft);
}
const DraftContext = createContext<Map<string, ChatDraft> | null>(null);
export function PipelineChatDrafts({ children }: { children: ReactNode }) {
  const drafts = useRef(new Map<string, ChatDraft>());
  return <DraftContext.Provider value={drafts.current}>{children}</DraftContext.Provider>;
}
export function useChatDrafts() { return useContext(DraftContext); }