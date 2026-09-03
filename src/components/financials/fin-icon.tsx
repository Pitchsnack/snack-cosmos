import { cn } from "@/lib/utils";

/** Sprite-backed icon from /public/icons/financial-icons.svg (stroke uses currentColor). */
export function FinIcon({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg className={cn("h-[18px] w-[18px] shrink-0", className)} style={style} aria-hidden="true">
      <use href={`/icons/financial-icons.svg#icon-${name}`} />
    </svg>
  );
}
