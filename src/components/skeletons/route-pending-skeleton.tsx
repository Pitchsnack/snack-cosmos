import { useLocation } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

function PageHeaderSkeleton({ actionWidth = "8rem" }: { actionWidth?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9" style={{ width: actionWidth }} />
      </div>
    </div>
  );
}

function FiltersRowSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Skeleton className="h-9 flex-1 min-w-[16rem]" />
      <Skeleton className="h-9 w-36" />
      <Skeleton className="h-9 w-36" />
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-9 w-44" />
      <Skeleton className="h-9 w-24" />
    </div>
  );
}

export function CardGridPageSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <PageHeaderSkeleton actionWidth="10rem" />
      <FiltersRowSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4 shadow-card space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TablePageSkeleton({ columns = 9 }: { columns?: number }) {
  return (
    <div className="space-y-6" aria-hidden="true">
      <PageHeaderSkeleton actionWidth="9rem" />
      <FiltersRowSkeleton />
      <div className="rounded-lg border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {Array.from({ length: columns }).map((_, i) => (
                <TableHead key={i}><Skeleton className="h-4 w-20" /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: columns }).map((__, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full max-w-[10rem]" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function GenericPageSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <PageHeaderSkeleton />
      <FiltersRowSkeleton />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

export function RoutePendingSkeleton() {
  const { pathname } = useLocation();
  if (pathname.includes("shared-deals") || pathname.includes("deals")) {
    return <TablePageSkeleton />;
  }
  if (pathname.includes("startups") || pathname.includes("investors")) {
    return <CardGridPageSkeleton />;
  }
  return <GenericPageSkeleton />;
}
