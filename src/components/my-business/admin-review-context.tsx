import { createContext, useContext } from "react";

/** Present only when Admin is reviewing a seller's My Business screen. */
export type AdminReview = {
  pendingCover: string | null;
  editsCount: number;
  notify: boolean;
  onToggleNotify: (v: boolean) => void;
  onSetImage: () => void;
  onShowEdits: () => void;
  onEditPrivate: () => void;
  onEditMedia: () => void;
};

export const AdminReviewCtx = createContext<AdminReview | null>(null);
export const useAdminReview = () => useContext(AdminReviewCtx);
