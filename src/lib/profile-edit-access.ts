/** Both conditions are supplied by server reads, never client edit options. */
export function canEditDirectoryInvestor(role: string | null, canManage: boolean) {
  return role === "admin" && canManage;
}