export type BuyOrderSort = 'newest' | 'closing' | 'views';
type SortableOrder = { status: string; sharedAt?: string | null; postedAt?: string | null; closesOn?: string | null; views: number };

export function sortBuyOrders<T extends SortableOrder>(orders: T[], sort: BuyOrderSort): T[] {
  return [...orders].sort((a, b) => {
    const closedA = a.status === 'closed', closedB = b.status === 'closed';
    if (closedA !== closedB) return closedA ? 1 : -1;
    if (!closedA && (a.sharedAt || b.sharedAt) && a.sharedAt !== b.sharedAt) return (b.sharedAt || '').localeCompare(a.sharedAt || '');
    const order = sort === 'views' ? b.views - a.views : sort === 'closing' ? (a.closesOn || '9999').localeCompare(b.closesOn || '9999') : (b.postedAt || '').localeCompare(a.postedAt || '');
    return order || (b.postedAt || '').localeCompare(a.postedAt || '');
  });
}