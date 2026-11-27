import { useState, type ReactNode } from 'react';

/** Delay construction, not just visibility; retain inputs after the first opening. */
export function KeepMountedDetails({ open, children }: { open: boolean; children: () => ReactNode }) {
  const [built, setBuilt] = useState(open);
  if (open && !built) setBuilt(true);
  return open || built ? children() : null;
}