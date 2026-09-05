"use client";

import { useState } from "react";
import { ExternalLink, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents, formatDate, formatNumber } from "@/lib/format";
import { trpc } from "@/trpc/client";

import { SubmissionFormDialog } from "./submission-form";

export function CreatorDashboard() {
  const campaigns = trpc.campaign.listActive.useQuery();
  const submissions = trpc.submission.listMine.useQuery();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>();
  const selectedCampaign = campaigns.data?.find((campaign) => campaign.id === selectedCampaignId);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Creator dashboard</h1>
        <p className="text-sm text-muted-foreground">Browse active campaigns and track your submitted clips.</p>
      </div>

      <section className="space-y-4" aria-labelledby="active-campaigns-heading">
        <div><h2 id="active-campaigns-heading" className="text-lg font-semibold">Active campaigns</h2><p className="text-sm text-muted-foreground">Campaigns currently accepting submissions.</p></div>
        {campaigns.isLoading ? <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div> : null}
        {campaigns.error ? <p role="alert" className="text-sm text-destructive">{campaigns.error.message}</p> : null}
        {campaigns.data?.length === 0 ? <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">There are no active campaigns right now.</div> : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.data?.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader><div className="flex items-start justify-between gap-2"><CardTitle className="text-base">{campaign.title}</CardTitle><Badge variant="outline">Active</Badge></div></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <dl className="grid grid-cols-2 gap-3"><div><dt className="text-muted-foreground">Payout</dt><dd className="font-medium">{formatCents(campaign.payoutPer1kViews)} / 1K</dd></div><div><dt className="text-muted-foreground">Ends</dt><dd className="font-medium">{formatDate(campaign.endsAt)}</dd></div></dl>
                <p className="capitalize text-muted-foreground">{campaign.platforms.join(" · ")}</p>
                <Button className="w-full" onClick={() => setSelectedCampaignId(campaign.id)}><Send /> Submit a clip</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader><CardTitle className="text-base">My submissions</CardTitle></CardHeader>
        <CardContent>
          {submissions.isLoading ? <Skeleton className="h-52 w-full" /> : null}
          {submissions.error ? <p role="alert" className="text-sm text-destructive">{submissions.error.message}</p> : null}
          {submissions.data?.length === 0 ? <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">You have not submitted any clips yet.</div> : null}
          {submissions.data?.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Campaign / post</TableHead><TableHead>Status</TableHead><TableHead>Views</TableHead><TableHead>Estimated earnings</TableHead></TableRow></TableHeader>
              <TableBody>{submissions.data.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell><div className="font-medium">{submission.campaignTitle}</div><a href={submission.postUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline">Open post <ExternalLink className="size-3" /></a>{submission.rejectionReason ? <p className="mt-1 text-xs text-destructive">{submission.rejectionReason}</p> : null}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{submission.status}</Badge></TableCell>
                  <TableCell>{formatNumber(submission.currentViews)}</TableCell>
                  <TableCell>{formatCents(submission.estimatedEarningsCents)}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      {selectedCampaign ? (
        <SubmissionFormDialog
          key={selectedCampaign.id}
          campaign={{ id: selectedCampaign.id, title: selectedCampaign.title, platforms: selectedCampaign.platforms }}
          open
          onOpenChange={(open) => { if (!open) setSelectedCampaignId(undefined); }}
        />
      ) : null}
    </main>
  );
}
