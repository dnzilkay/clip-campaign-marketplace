"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleDollarSign,
  ExternalLink,
  Eye,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { trpc } from "@/trpc/client";

import { PlatformBadges, StatusBadge } from "./status-badge";

export function CampaignDetail({
  campaignId,
  onBack,
}: {
  campaignId: string;
  onBack: () => void;
}) {
  const [rejectingId, setRejectingId] = useState<string>();
  const [reason, setReason] = useState("");
  const detail = trpc.campaign.adminDetail.useQuery({ campaignId });
  const utils = trpc.useUtils();

  const refresh = async () => {
    await Promise.all([
      utils.campaign.adminDetail.invalidate({ campaignId }),
      utils.campaign.listAdmin.invalidate(),
    ]);
  };

  const approve = trpc.submission.approve.useMutation({ onSuccess: refresh });
  const reject = trpc.submission.reject.useMutation({
    onSuccess: async () => {
      setRejectingId(undefined);
      setReason("");
      await refresh();
    },
  });

  if (detail.isLoading) {
    return (
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  if (detail.error || !detail.data) {
    return (
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft /> Back
        </Button>
        <Alert variant="destructive">
          <AlertTitle>Campaign unavailable</AlertTitle>
          <AlertDescription>
            {detail.error?.message ?? "Campaign not found"}
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const { campaign, overview, reviewQueue } = detail.data;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:py-12">
      <Button variant="ghost" className="-ml-3" onClick={onBack}>
        <ArrowLeft /> Back to campaigns
      </Button>

      <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={campaign.status} />
              <span className="text-sm text-muted-foreground">
                {formatDate(campaign.startsAt)} – {formatDate(campaign.endsAt)}
              </span>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {campaign.title}
              </h1>
              <PlatformBadges platforms={campaign.platforms} />
            </div>
          </div>

          <div className="min-w-64 rounded-xl bg-foreground p-5 text-background">
            <p className="text-sm text-background/70">Creator payout</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatMoney(campaign.payoutPer1kViews)}
            </p>
            <p className="mt-1 text-sm text-background/70">per 1,000 views</p>
          </div>
        </div>
      </section>

      {approve.error ? (
        <Alert variant="destructive">
          <AlertTitle>Approval failed</AlertTitle>
          <AlertDescription>
            {approve.error.data?.domainCode === "CAMPAIGN_BUDGET_EXCEEDED"
              ? "The campaign does not have enough remaining budget for this submission."
              : approve.error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-label="Campaign overview" className="grid gap-4 md:grid-cols-3">
        <Stat
          icon={Eye}
          label="Approved views"
          value={formatNumber(overview.totalApprovedViews)}
        />
        <Stat
          icon={WalletCards}
          label="Budget spent"
          value={formatMoney(overview.budgetSpent)}
        />
        <Stat
          icon={CircleDollarSign}
          label="Budget remaining"
          value={formatMoney(overview.budgetLeft)}
        />
      </section>

      <Card className="shadow-sm">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-xl">Daily views</CardTitle>
          <p className="text-sm text-muted-foreground">
            Approved views gained across the full campaign period.
          </p>
        </CardHeader>
        <CardContent>
          <DailyViewsChart data={overview.chart} />
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <CardHeader className="border-b bg-muted/30 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Review queue</CardTitle>
            <p className="text-sm text-muted-foreground">
              {reviewQueue.length} pending submission
              {reviewQueue.length === 1 ? "" : "s"}
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {reviewQueue.length === 0 ? (
            <div className="m-6 rounded-xl border border-dashed p-12 text-center text-base text-muted-foreground">
              No pending submissions.
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table className="text-base">
                  <TableHeader>
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableHead className="px-6">Creator</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead>Estimated payout</TableHead>
                      <TableHead className="px-6 text-right">Decision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewQueue.map((submission) => (
                      <TableRow key={submission.id} className="h-24">
                        <TableCell className="px-6">
                          <div className="space-y-2">
                            <p className="font-semibold">{submission.creatorEmail}</p>
                            <a
                              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                              href={submission.postUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open post <ExternalLink className="size-3.5" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">
                          {submission.platform}
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">
                          {formatNumber(submission.currentViews)}
                        </TableCell>
                        <TableCell className="font-semibold tabular-nums">
                          {formatMoney(submission.estimatedPayoutCents)}
                        </TableCell>
                        <TableCell className="px-6">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                approve.mutate({ submissionId: submission.id })
                              }
                              disabled={approve.isPending || reject.isPending}
                            >
                              <Check /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRejectingId(submission.id)}
                            >
                              <X /> Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y md:hidden">
                {reviewQueue.map((submission) => (
                  <article key={submission.id} className="space-y-5 p-5">
                    <div className="space-y-2">
                      <p className="font-semibold">{submission.creatorEmail}</p>
                      <a
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
                        href={submission.postUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open post <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                    <dl className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-4">
                      <div>
                        <dt className="text-sm text-muted-foreground">Views</dt>
                        <dd className="mt-1 font-semibold">
                          {formatNumber(submission.currentViews)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">Payout</dt>
                        <dd className="mt-1 font-semibold">
                          {formatMoney(submission.estimatedPayoutCents)}
                        </dd>
                      </div>
                    </dl>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={() =>
                          approve.mutate({ submissionId: submission.id })
                        }
                        disabled={approve.isPending || reject.isPending}
                      >
                        <Check /> Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setRejectingId(submission.id)}
                      >
                        <X /> Reject
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!rejectingId}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingId(undefined);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject submission</DialogTitle>
            <DialogDescription>
              Give the creator a concrete reason. This field is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Reason</Label>
            <Textarea
              id="rejection-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
            />
          </div>
          {reject.error ? (
            <p role="alert" className="text-sm text-destructive">
              {reject.error.message}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectingId(undefined)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || reject.isPending}
              onClick={() =>
                rejectingId &&
                reject.mutate({
                  submissionId: rejectingId,
                  rejectionReason: reason,
                })
              }
            >
              {reject.isPending ? "Rejecting…" : "Reject submission"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex-row items-center gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <CardTitle className="mt-1 truncate text-2xl tabular-nums">
            {value}
          </CardTitle>
        </div>
      </CardHeader>
    </Card>
  );
}

function DailyViewsChart({
  data,
}: {
  data: Array<{ date: string; views: number }>;
}) {
  const max = Math.max(1, ...data.map((item) => item.views));

  return (
    <div
      className="overflow-x-auto"
      role="img"
      aria-label="Bar chart of daily views across the campaign period"
    >
      <div className="flex h-52 min-w-max items-end gap-1.5 border-b px-1 pt-4">
        {data.map((item) => (
          <div
            key={item.date}
            className="group flex w-5 flex-col items-center justify-end"
            title={`${item.date}: ${formatNumber(item.views)} views`}
          >
            <div
              className="w-full rounded-t bg-foreground/80 transition-colors group-hover:bg-foreground"
              style={{
                height: `${Math.max(
                  item.views === 0 ? 2 : 8,
                  (item.views / max) * 180,
                )}px`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-sm text-muted-foreground">
        <span>{data[0]?.date}</span>
        <span>{data.at(-1)?.date}</span>
      </div>
    </div>
  );
}
