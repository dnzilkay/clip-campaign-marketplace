"use client";

import { useState } from "react";
import { ArrowLeft, Check, ExternalLink, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCents, formatDate, formatNumber } from "@/lib/format";
import { trpc } from "@/trpc/client";

export function CampaignDetail({ campaignId, onBack }: { campaignId: string; onBack: () => void }) {
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
    return <main className="mx-auto max-w-7xl space-y-4 px-6 py-8"><Skeleton className="h-10 w-56" /><Skeleton className="h-96 w-full" /></main>;
  }

  if (detail.error || !detail.data) {
    return <main className="mx-auto max-w-4xl space-y-4 px-6 py-8"><Button variant="ghost" onClick={onBack}><ArrowLeft /> Back</Button><Alert variant="destructive"><AlertTitle>Campaign unavailable</AlertTitle><AlertDescription>{detail.error?.message ?? "Campaign not found"}</AlertDescription></Alert></main>;
  }

  const { campaign, overview, reviewQueue } = detail.data;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <Button variant="ghost" onClick={onBack}><ArrowLeft /> Back to campaigns</Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="mb-2 flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">{campaign.title}</h1><Badge variant="outline" className="capitalize">{campaign.status}</Badge></div><p className="text-sm text-muted-foreground">{formatDate(campaign.startsAt)} – {formatDate(campaign.endsAt)} · {campaign.platforms.join(", ")}</p></div>
        <p className="text-sm font-medium">{formatCents(campaign.payoutPer1kViews)} / 1K views</p>
      </div>

      {approve.error ? <Alert variant="destructive"><AlertTitle>Approval failed</AlertTitle><AlertDescription>{approve.error.data?.domainCode === "CAMPAIGN_BUDGET_EXCEEDED" ? "The campaign does not have enough remaining budget for this submission." : approve.error.message}</AlertDescription></Alert> : null}

      <section aria-label="Campaign overview" className="grid gap-4 md:grid-cols-3">
        <Stat label="Approved views" value={formatNumber(overview.totalApprovedViews)} />
        <Stat label="Budget spent" value={formatCents(overview.budgetSpent)} />
        <Stat label="Budget left" value={formatCents(overview.budgetLeft)} />
      </section>

      <Card>
        <CardHeader><CardTitle className="text-base">Daily views</CardTitle></CardHeader>
        <CardContent><DailyViewsChart data={overview.chart} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Review queue <span className="font-normal text-muted-foreground">({reviewQueue.length})</span></CardTitle></CardHeader>
        <CardContent>
          {reviewQueue.length === 0 ? <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No pending submissions.</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Creator / post</TableHead><TableHead>Platform</TableHead><TableHead>Views</TableHead><TableHead>Estimated payout</TableHead><TableHead className="text-right">Review</TableHead></TableRow></TableHeader>
              <TableBody>{reviewQueue.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell><div className="font-medium">{submission.creatorEmail}</div><a className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline" href={submission.postUrl} target="_blank" rel="noreferrer">Open post <ExternalLink className="size-3" /></a></TableCell>
                  <TableCell className="capitalize">{submission.platform}</TableCell>
                  <TableCell>{formatNumber(submission.currentViews)}</TableCell>
                  <TableCell>{formatCents(submission.estimatedPayoutCents)}</TableCell>
                  <TableCell><div className="flex justify-end gap-2"><Button size="sm" onClick={() => approve.mutate({ submissionId: submission.id })} disabled={approve.isPending || reject.isPending}><Check /> Approve</Button><Button size="sm" variant="outline" onClick={() => setRejectingId(submission.id)}><X /> Reject</Button></div></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rejectingId} onOpenChange={(open) => { if (!open) { setRejectingId(undefined); setReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject submission</DialogTitle><DialogDescription>Give the creator a concrete reason. This field is required.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label htmlFor="rejection-reason">Reason</Label><Textarea id="rejection-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} /></div>
          {reject.error ? <p role="alert" className="text-sm text-destructive">{reject.error.message}</p> : null}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRejectingId(undefined)}>Cancel</Button><Button variant="destructive" disabled={!reason.trim() || reject.isPending} onClick={() => rejectingId && reject.mutate({ submissionId: rejectingId, rejectionReason: reason })}>{reject.isPending ? "Rejecting…" : "Reject submission"}</Button></div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <Card><CardHeader className="pb-2"><p className="text-sm text-muted-foreground">{label}</p><CardTitle className="text-2xl">{value}</CardTitle></CardHeader></Card>;
}

function DailyViewsChart({ data }: { data: Array<{ date: string; views: number }> }) {
  const max = Math.max(1, ...data.map((item) => item.views));

  return (
    <div className="overflow-x-auto" role="img" aria-label="Bar chart of daily views across the campaign period">
      <div className="flex h-52 min-w-max items-end gap-1 border-b px-1 pt-4">
        {data.map((item) => (
          <div key={item.date} className="group flex w-5 flex-col items-center justify-end" title={`${item.date}: ${formatNumber(item.views)} views`}>
            <div className="w-full rounded-t bg-primary transition-colors group-hover:bg-primary/75" style={{ height: `${Math.max(item.views === 0 ? 2 : 8, (item.views / max) * 180)}px` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{data[0]?.date}</span><span>{data.at(-1)?.date}</span></div>
    </div>
  );
}
