"use client";

import { useState } from "react";
import { CalendarDays, CircleDollarSign, ExternalLink, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { trpc } from "@/trpc/client";

import { PlatformBadges, StatusBadge } from "./status-badge";
import { SubmissionFormDialog } from "./submission-form";

export function CreatorDashboard() {
  const campaigns = trpc.campaign.listActive.useQuery();
  const submissions = trpc.submission.listMine.useQuery();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>();
  const selectedCampaign = campaigns.data?.find(
    (campaign) => campaign.id === selectedCampaignId,
  );

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6 lg:py-12">
      <section className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Creator workspace
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Find your next campaign
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          Submit published clips to active campaigns and track their performance.
        </p>
      </section>

      <section className="space-y-5" aria-labelledby="active-campaigns-heading">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 id="active-campaigns-heading" className="text-2xl font-semibold">
              Active campaigns
            </h2>
            <p className="text-base text-muted-foreground">
              Currently accepting creator submissions.
            </p>
          </div>
          {campaigns.data ? (
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
              {campaigns.data.length} available
            </span>
          ) : null}
        </div>

        {campaigns.isLoading ? (
          <div className="grid gap-5 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : null}

        {campaigns.error ? (
          <p role="alert" className="text-sm text-destructive">
            {campaigns.error.message}
          </p>
        ) : null}

        {campaigns.data?.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-base text-muted-foreground">
            There are no active campaigns right now.
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          {campaigns.data?.map((campaign) => (
            <Card
              key={campaign.id}
              className="relative overflow-hidden border-0 shadow-sm ring-1 ring-foreground/10"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
              <CardHeader className="gap-4 pt-2">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-xl font-semibold">
                    {campaign.title}
                  </CardTitle>
                  <StatusBadge status="active" />
                </div>
                <PlatformBadges platforms={campaign.platforms} />
              </CardHeader>
              <CardContent className="space-y-5">
                <dl className="grid grid-cols-2 gap-4 rounded-xl bg-muted/50 p-4">
                  <div className="space-y-1">
                    <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CircleDollarSign className="size-4" aria-hidden="true" />
                      Payout per 1K
                    </dt>
                    <dd className="text-lg font-semibold tabular-nums">
                      {formatMoney(campaign.payoutPer1kViews)}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="size-4" aria-hidden="true" />
                      Ends
                    </dt>
                    <dd className="text-lg font-semibold">
                      {formatDate(campaign.endsAt)}
                    </dd>
                  </div>
                </dl>
                <Button
                  className="h-11 w-full"
                  onClick={() => setSelectedCampaignId(campaign.id)}
                >
                  <Send /> Submit a clip
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-5" aria-labelledby="my-submissions-heading">
        <div className="space-y-1">
          <h2 id="my-submissions-heading" className="text-2xl font-semibold">
            My submissions
          </h2>
          <p className="text-base text-muted-foreground">
            Current status, views, and earnings for your clips.
          </p>
        </div>

        <Card className="gap-0 overflow-hidden py-0 shadow-sm">
          <CardContent className="p-0">
            {submissions.isLoading ? (
              <div className="p-6">
                <Skeleton className="h-52 w-full" />
              </div>
            ) : null}

            {submissions.error ? (
              <p role="alert" className="p-6 text-sm text-destructive">
                {submissions.error.message}
              </p>
            ) : null}

            {submissions.data?.length === 0 ? (
              <div className="m-6 rounded-xl border border-dashed p-12 text-center text-base text-muted-foreground">
                You have not submitted any clips yet.
              </div>
            ) : null}

            {submissions.data?.length ? (
              <>
                <div className="hidden md:block">
                  <Table className="text-base">
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="px-6">Campaign</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Current views</TableHead>
                        <TableHead className="px-6 text-right">
                          Estimated earnings
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.data.map((submission) => (
                        <TableRow key={submission.id} className="h-24">
                          <TableCell className="px-6">
                            <div className="space-y-2">
                              <p className="font-semibold">
                                {submission.campaignTitle}
                              </p>
                              <a
                                href={submission.postUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                              >
                                Open post <ExternalLink className="size-3.5" />
                              </a>
                              {submission.rejectionReason ? (
                                <p className="max-w-md text-sm text-destructive">
                                  {submission.rejectionReason}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={submission.status} />
                          </TableCell>
                          <TableCell className="font-medium tabular-nums">
                            {formatNumber(submission.currentViews)}
                          </TableCell>
                          <TableCell className="px-6 text-right font-semibold tabular-nums">
                            {formatMoney(submission.estimatedEarningsCents)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="divide-y md:hidden">
                  {submissions.data.map((submission) => (
                    <article key={submission.id} className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold">
                          {submission.campaignTitle}
                        </h3>
                        <StatusBadge status={submission.status} />
                      </div>
                      <dl className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-4">
                        <div>
                          <dt className="text-sm text-muted-foreground">Views</dt>
                          <dd className="mt-1 font-semibold tabular-nums">
                            {formatNumber(submission.currentViews)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-sm text-muted-foreground">Earnings</dt>
                          <dd className="mt-1 font-semibold tabular-nums">
                            {formatMoney(submission.estimatedEarningsCents)}
                          </dd>
                        </div>
                      </dl>
                      {submission.rejectionReason ? (
                        <p className="text-sm text-destructive">
                          {submission.rejectionReason}
                        </p>
                      ) : null}
                      <Button variant="outline" className="w-full" asChild>
                        <a
                          href={submission.postUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open post <ExternalLink />
                        </a>
                      </Button>
                    </article>
                  ))}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {selectedCampaign ? (
        <SubmissionFormDialog
          key={selectedCampaign.id}
          campaign={{
            id: selectedCampaign.id,
            title: selectedCampaign.title,
            platforms: selectedCampaign.platforms,
          }}
          open
          onOpenChange={(open) => {
            if (!open) {
              setSelectedCampaignId(undefined);
            }
          }}
        />
      ) : null}
    </main>
  );
}
