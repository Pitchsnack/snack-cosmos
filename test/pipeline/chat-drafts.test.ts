import { describe, expect, it } from 'vitest';
import { draftKey, saveDraft, type ChatDraft } from '../../src/components/messages/chat-drafts';
describe('Pipeline chat drafts', () => {
  it('keeps unsent text for the same deal after closing and reopening', () => {
    const drafts = new Map<string, ChatDraft>();
    saveDraft(drafts, draftKey('seller', 'deal-1'), { text: 'Unsent message', files: [] });
    expect(drafts.get(draftKey('seller', 'deal-1'))?.text).toBe('Unsent message');
    expect(drafts.get(draftKey('seller', 'deal-2'))).toBeUndefined();
    expect(drafts.get(draftKey('buyer', 'deal-1'))).toBeUndefined();
  });
  it('clears the draft after sending empties the composer', () => {
    const drafts = new Map<string, ChatDraft>();
    const key = draftKey('buyer', 'deal-1');
    saveDraft(drafts, key, { text: 'Ready to send', files: [] });
    saveDraft(drafts, key, { text: '', files: [] });
    expect(drafts.has(key)).toBe(false);
  });
});