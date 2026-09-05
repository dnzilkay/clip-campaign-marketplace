import { Badge } from "@/components/ui/badge";

const statusStyles = {
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  paused: "border-amber-200 bg-amber-50 text-amber-800",
  completed: "border-blue-200 bg-blue-50 text-blue-700",
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  paid: "border-violet-200 bg-violet-50 text-violet-700",
} as const;

type Status = keyof typeof statusStyles;

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant="outline" className={statusStyles[status]}>
      <span
        className="size-1.5 rounded-full bg-current"
        aria-hidden="true"
      />
      <span className="capitalize">{status}</span>
    </Badge>
  );
}

export function PlatformBadges({ platforms }: { platforms: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {platforms.map((platform) => (
        <Badge
          key={platform}
          variant="secondary"
          className="h-7 bg-muted text-sm capitalize text-muted-foreground"
        >
          {platform}
        </Badge>
      ))}
    </div>
  );
}
