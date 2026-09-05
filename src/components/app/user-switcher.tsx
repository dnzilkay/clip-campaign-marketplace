"use client";

import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/trpc/client";

export function UserSwitcher({
  currentUserId,
  compact = false,
}: {
  currentUserId?: string;
  compact?: boolean;
}) {
  const users = trpc.auth.availableUsers.useQuery();
  const switchUser = trpc.auth.switchUser.useMutation({
    onSuccess: () => window.location.reload(),
  });
  const signOut = trpc.auth.signOut.useMutation({
    onSuccess: () => window.location.reload(),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={currentUserId}
        onValueChange={(userId) => switchUser.mutate({ userId })}
        disabled={users.isLoading || switchUser.isPending}
      >
        <SelectTrigger
          aria-label="Switch demo user"
          className={compact ? "w-64" : "w-full"}
        >
          <SelectValue placeholder="Choose a demo user" />
        </SelectTrigger>
        <SelectContent>
          {users.data?.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.email} ({user.role})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {currentUserId ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Sign out"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
        >
          <LogOut />
        </Button>
      ) : null}
    </div>
  );
}
