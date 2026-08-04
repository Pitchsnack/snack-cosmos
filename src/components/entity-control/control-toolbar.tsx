import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ControlPagination({
  page,
  pageSize,
  total,
  approximate,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  approximate?: boolean;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        Showing {from.toLocaleString()}–{to.toLocaleString()} of {approximate ? "~" : ""}
        {total.toLocaleString()} records
      </span>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">Rows per page</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
          <SelectTrigger className="h-8 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[25, 50, 100].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(1)}>
            «
          </Button>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            ‹
          </Button>
          <span className="px-2 tabular-nums text-muted-foreground">
            {page.toLocaleString()} / {pageCount.toLocaleString()}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
            ›
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPage(pageCount)}>
            »
          </Button>
        </div>
      </div>
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  width = "w-40",
}: {
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  onChange: (v: string | undefined) => void;
  width?: string;
}) {
  return (
    <Select value={value ?? "__all"} onValueChange={(v) => onChange(v === "__all" ? undefined : v)}>
      <SelectTrigger className={`h-9 ${width}`}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value="__all">{label}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StatusTabs({
  value,
  onChange,
  counts,
}: {
  value: "all" | "published" | "unpublished";
  onChange: (v: "all" | "published" | "unpublished") => void;
  counts: { all?: number; published?: number; unpublished?: number };
}) {
  const items: { key: "all" | "unpublished" | "published"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unpublished", label: "Unpublished" },
    { key: "published", label: "Published" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onChange(it.key)}
          className={
            "inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors " +
            (value === it.key
              ? "bg-accent/10 text-accent"
              : "text-muted-foreground hover:bg-muted hover:text-foreground")
          }
        >
          {it.label}
          {typeof counts[it.key] === "number" && (
            <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
              {counts[it.key]!.toLocaleString()}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function BulkBar({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
      <span className="text-sm font-medium">{count} selected</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
