"use client";

import { useState } from "react";
import { Eye, Pencil, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { trpc } from "@/trpc/client";

import { CampaignDetail } from "./campaign-detail";
import { CampaignFormDialog } from "./campaign-form";
import { PlatformBadges, StatusBadge } from "./status-badge";

const campaignStatuses = ["draft", "active", "paused", "completed"] as const;

export function AdminDashboard() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const campaigns = trpc.campaign.listAdmin.useQuery({
    page,
    pageSize: 10,
    search,
    status:
      status === "all"
        ? undefined
        : (status as (typeof campaignStatuses)[number]),
  });

  if (selectedId) {
    return (
      <CampaignDetail
        campaignId={selectedId}
        onBack={() => setSelectedId(undefined)}
      />
    );
  }

  const editingCampaign = campaigns.data?.items.find(
    (item) => item.id === editingId,
  );

  const openCreateForm = () => {
    setEditingId(undefined);
    setFormOpen(true);
  };

  const openEditForm = (campaignId: string) => {
    setEditingId(campaignId);
    setFormOpen(true);
  };

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:py-12">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Campaign management
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Campaigns
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            Create campaigns, control budgets, and review creator submissions.
          </p>
        </div>
        <Button className="h-11 px-5" onClick={openCreateForm}>
          <Plus /> Create campaign
        </Button>
      </section>

      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <CardHeader className="gap-5 border-b bg-muted/30 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">All campaigns</CardTitle>
            <p className="text-sm text-muted-foreground">
              {campaigns.data
                ? `${campaigns.data.total} campaign${campaigns.data.total === 1 ? "" : "s"}`
                : "Loading campaigns…"}
            </p>
          </div>
          <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-[minmax(240px,320px)_190px]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                className="h-11 pl-9 text-base"
                type="search"
                aria-label="Search campaigns by title"
                placeholder="Search campaigns"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger
                className="w-full"
                aria-label="Filter campaigns by status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {campaignStatuses.map((value) => (
                  <SelectItem key={value} value={value} className="capitalize">
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {campaigns.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-72 w-full" />
            </div>
          ) : null}

          {campaigns.error ? (
            <p role="alert" className="p-6 text-sm text-destructive">
              {campaigns.error.message}
            </p>
          ) : null}

          {campaigns.data?.items.length === 0 ? (
            <div className="m-6 rounded-xl border border-dashed p-12 text-center text-base text-muted-foreground">
              No campaigns match these filters.
            </div>
          ) : null}

          {campaigns.data?.items.length ? (
            <>
              <div className="hidden md:block">
                <Table className="text-base">
                  <TableHeader>
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableHead className="px-6">Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="px-6 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.data.items.map((campaign) => (
                      <TableRow key={campaign.id} className="h-24">
                        <TableCell className="px-6">
                          <div className="space-y-2">
                            <p className="font-semibold">{campaign.title}</p>
                            <PlatformBadges platforms={campaign.platforms} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={campaign.status} />
                        </TableCell>
                        <TableCell className="font-semibold tabular-nums">
                          {formatMoney(campaign.totalBudget)}
                        </TableCell>
                        <TableCell className="text-sm leading-relaxed text-muted-foreground">
                          {formatDate(campaign.startsAt)}
                          <br />
                          {formatDate(campaign.endsAt)}
                        </TableCell>
                        <TableCell className="px-6">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditForm(campaign.id)}
                            >
                              <Pencil /> Edit
                            </Button>
                            <Button
                              size="sm"
                              aria-label={`View ${campaign.title}`}
                              onClick={() => setSelectedId(campaign.id)}
                            >
                              <Eye /> View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y md:hidden">
                {campaigns.data.items.map((campaign) => (
                  <article key={campaign.id} className="space-y-5 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-lg font-semibold">{campaign.title}</h2>
                      <StatusBadge status={campaign.status} />
                    </div>
                    <PlatformBadges platforms={campaign.platforms} />
                    <dl className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-4">
                      <div>
                        <dt className="text-sm text-muted-foreground">Budget</dt>
                        <dd className="mt-1 font-semibold">
                          {formatMoney(campaign.totalBudget)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">Ends</dt>
                        <dd className="mt-1 font-semibold">
                          {formatDate(campaign.endsAt)}
                        </dd>
                      </div>
                    </dl>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        onClick={() => openEditForm(campaign.id)}
                      >
                        <Pencil /> Edit
                      </Button>
                      <Button onClick={() => setSelectedId(campaign.id)}>
                        <Eye /> View details
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : null}

          {campaigns.data ? (
            <div className="flex flex-col gap-3 border-t bg-muted/20 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <span className="text-muted-foreground">
                Page {campaigns.data.page} of {campaigns.data.pageCount} ·{" "}
                {campaigns.data.total} total
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={page >= campaigns.data.pageCount}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <CampaignFormDialog
        key={editingCampaign?.id ?? "create"}
        open={formOpen}
        onOpenChange={setFormOpen}
        campaign={
          editingCampaign
            ? {
                id: editingCampaign.id,
                title: editingCampaign.title,
                platforms: editingCampaign.platforms,
                payoutPer1kViews: editingCampaign.payoutPer1kViews,
                totalBudget: editingCampaign.totalBudget,
                status: editingCampaign.status,
                startsAt: editingCampaign.startsAt.toISOString(),
                endsAt: editingCampaign.endsAt.toISOString(),
              }
            : undefined
        }
      />
    </main>
  );
}
