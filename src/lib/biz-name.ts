import { tr } from "@/i18n/language";
/** A business with no name yet (a Draft from + Add My Business) shows "New business". */
export const bizName = (n: string | null | undefined) => (n && n.trim() ? n : tr("New business"));
