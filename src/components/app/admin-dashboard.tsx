"use client";

import { useState } from "react";
import { Eye, Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents, formatDate } from "@/lib/format";
import { trpc } from "@/trpc/client";

import { CampaignDetail } from "./campaign-detail";
import { CampaignFormDialog } from "./campaign-form";

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
    status: status === "all" ? undefined : status as "draft" | "active" | "paused" | "completed",
  });

  if (selectedId) {
    return <CampaignDetail campaignId={selectedId} onBack={() => setSelectedId(undefined)} />;
  }

  const editingCampaign = campaigns.data?.items.find((item) => item.id === editingId);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Manage campaigns and review creator submissions.</p>
        </div>
        <Button onClick={() => { setEditingId(undefined); setFormOpen(true); }}><Plus /> Create campaign</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Campaign list</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <Input
              type="search"
              aria-label="Search campaigns by title"
              placeholder="Search by title…"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            />
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
              <SelectTrigger aria-label="Filter campaigns by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(["draft", "active", "paused", "completed"] as const).map((value) => (
                  <SelectItem key={value} value={value} className="capitalize">{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {campaigns.isLoading ? <Skeleton className="h-64 w-full" /> : null}
          {campaigns.error ? <p role="alert" className="text-sm text-destructive">{campaigns.error.message}</p> : null}
          {campaigns.data?.items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No campaigns match these filters.</div>
          ) : null}
          {campaigns.data?.items.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead>Status</TableHead><TableHead>Budget</TableHead><TableHead>Period</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {campaigns.data.items.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell><div className="font-medium">{campaign.title}</div><div className="text-xs capitalize text-muted-foreground">{campaign.platforms.join(" · ")}</div></TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{campaign.status}</Badge></TableCell>
                    <TableCell>{formatCents(campaign.totalBudget)}</TableCell>
                    <TableCell className="text-sm">{formatDate(campaign.startsAt)} – {formatDate(campaign.endsAt)}</TableCell>
                    <TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={`Edit ${campaign.title}`} onClick={() => { setEditingId(campaign.id); setFormOpen(true); }}><Pencil /></Button><Button variant="ghost" size="icon" aria-label={`View ${campaign.title}`} onClick={() => setSelectedId(campaign.id)}><Eye /></Button></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}

          {campaigns.data ? (
            <div className="flex items-center justify-between border-t pt-4 text-sm">
              <span className="text-muted-foreground">Page {campaigns.data.page} of {campaigns.data.pageCount} · {campaigns.data.total} total</span>
              <div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" disabled={page >= campaigns.data.pageCount} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <CampaignFormDialog
        key={editingCampaign?.id ?? "create"}
        open={formOpen}
        onOpenChange={setFormOpen}
        campaign={editingCampaign ? {
          id: editingCampaign.id,
          title: editingCampaign.title,
          platforms: editingCampaign.platforms,
          payoutPer1kViews: editingCampaign.payoutPer1kViews,
          totalBudget: editingCampaign.totalBudget,
          status: editingCampaign.status,
          startsAt: editingCampaign.startsAt.toISOString(),
          endsAt: editingCampaign.endsAt.toISOString(),
        } : undefined}
      />
    </main>
  );
}
