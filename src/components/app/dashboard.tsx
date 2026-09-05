"use client";

import { ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/client";

import { AdminDashboard } from "./admin-dashboard";
import { CreatorDashboard } from "./creator-dashboard";
import { UserSwitcher } from "./user-switcher";

export function Dashboard() {
  const session = trpc.auth.session.useQuery();

  if (session.isLoading) {
    return (
      <main className="mx-auto max-w-6xl space-y-4 p-6">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-80 w-full" />
      </main>
    );
  }

  if (session.error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Alert variant="destructive">
          <AlertTitle>Unable to load the application</AlertTitle>
          <AlertDescription>{session.error.message}</AlertDescription>
        </Alert>
      </main>
    );
  }

  const user = session.data?.user;

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck aria-hidden="true" />
            </div>
            <CardTitle>Clip Campaigns</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose a seeded user to review the role-protected flows.
            </p>
          </CardHeader>
          <CardContent>
            <UserSwitcher />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="font-semibold">Clip Campaigns</p>
            <p className="text-sm text-muted-foreground">
              {user.role === "admin" ? "Admin workspace" : "Creator workspace"}
            </p>
          </div>
          <UserSwitcher currentUserId={user.id} compact />
        </div>
      </header>
      {user.role === "admin" ? <AdminDashboard /> : <CreatorDashboard />}
    </div>
  );
}
