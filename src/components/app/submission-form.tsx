"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createSubmissionSchema,
  type CreateSubmissionInput,
} from "@/shared/schemas/submission";
import { trpc } from "@/trpc/client";

type Platform = CreateSubmissionInput["platform"];

export function SubmissionFormDialog({
  campaign,
  open,
  onOpenChange,
}: {
  campaign: { id: string; title: string; platforms: Platform[] };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const form = useForm<CreateSubmissionInput>({
    resolver: zodResolver(createSubmissionSchema),
    defaultValues: {
      campaignId: campaign.id,
      postUrl: "",
      platform: campaign.platforms[0],
    },
  });
  const createSubmission = trpc.submission.create.useMutation({
    onSuccess: async () => {
      await utils.submission.listMine.invalidate();
      form.reset();
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit a clip</DialogTitle>
          <DialogDescription>{campaign.title}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          noValidate
          onSubmit={form.handleSubmit((values) => createSubmission.mutate(values))}
        >
          <Controller
            control={form.control}
            name="platform"
            render={({ field }) => (
              <div className="space-y-2">
                <Label htmlFor="submission-platform">Platform</Label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="submission-platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {campaign.platforms.map((platform) => (
                      <SelectItem key={platform} value={platform} className="capitalize">
                        {platform}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
          <div className="space-y-2">
            <Label htmlFor="post-url">Post URL</Label>
            <Input
              id="post-url"
              type="url"
              placeholder="https://…"
              aria-invalid={!!form.formState.errors.postUrl}
              {...form.register("postUrl")}
            />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Use a public TikTok video, Instagram reel/post, YouTube Short, or youtu.be URL.
            </p>
            {form.formState.errors.postUrl ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.postUrl.message}</p> : null}
          </div>
          {createSubmission.error ? <p role="alert" className="text-sm text-destructive">{createSubmission.error.message}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createSubmission.isPending}>{createSubmission.isPending ? "Submitting…" : "Submit clip"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
