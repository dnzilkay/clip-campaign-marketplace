"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toDateTimeLocal } from "@/lib/format";
import {
  campaignFormSchema,
  type CampaignFormValues,
} from "@/shared/schemas/campaign";
import { trpc } from "@/trpc/client";

const platforms = ["tiktok", "instagram", "youtube"] as const;

type EditableCampaign = CampaignFormValues & { id: string };

export function CampaignFormDialog({
  open,
  onOpenChange,
  campaign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: EditableCampaign;
}) {
  const utils = trpc.useUtils();
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: campaign
      ? {
          ...campaign,
          startsAt: toDateTimeLocal(campaign.startsAt),
          endsAt: toDateTimeLocal(campaign.endsAt),
        }
      : {
          title: "",
          platforms: [],
          payoutPer1kViews: 100,
          totalBudget: 10_000,
          status: "draft",
          startsAt: toDateTimeLocal(new Date()),
          endsAt: toDateTimeLocal(
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
          ),
        },
  });
  const onSuccess = async () => {
    await utils.campaign.listAdmin.invalidate();
    onOpenChange(false);
  };
  const createCampaign = trpc.campaign.create.useMutation({ onSuccess });
  const updateCampaign = trpc.campaign.update.useMutation({ onSuccess });
  const mutationError = createCampaign.error ?? updateCampaign.error;
  const isPending = createCampaign.isPending || updateCampaign.isPending;

  const submit = form.handleSubmit((values) => {
    const normalizedValues = {
      ...values,
      startsAt: new Date(values.startsAt).toISOString(),
      endsAt: new Date(values.endsAt).toISOString(),
    };

    if (campaign) {
      updateCampaign.mutate({ id: campaign.id, values: normalizedValues });
    } else {
      createCampaign.mutate(normalizedValues);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit campaign" : "Create campaign"}</DialogTitle>
          <DialogDescription>
            Amounts are stored as integer cents. All fields are validated again on
            the server.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={submit} noValidate>
          <Field
            id="campaign-title"
            label="Title"
            error={form.formState.errors.title?.message}
          >
            <Input
              id="campaign-title"
              {...form.register("title")}
              aria-invalid={!!form.formState.errors.title}
            />
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Platforms</legend>
            <Controller
              control={form.control}
              name="platforms"
              render={({ field }) => (
                <div className="flex flex-wrap gap-4">
                  {platforms.map((platform) => (
                    <Label key={platform} className="gap-2 capitalize">
                      <Checkbox
                        checked={field.value.includes(platform)}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked
                              ? [...field.value, platform]
                              : field.value.filter((value) => value !== platform),
                          )
                        }
                      />
                      {platform}
                    </Label>
                  ))}
                </div>
              )}
            />
            <FieldError message={form.formState.errors.platforms?.message} />
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="campaign-payout"
              label="Payout per 1K views (cents)"
              error={form.formState.errors.payoutPer1kViews?.message}
            >
              <Input
                id="campaign-payout"
                type="number"
                min={1}
                {...form.register("payoutPer1kViews", { valueAsNumber: true })}
                aria-invalid={!!form.formState.errors.payoutPer1kViews}
              />
            </Field>
            <Field
              id="campaign-budget"
              label="Total budget (cents)"
              error={form.formState.errors.totalBudget?.message}
            >
              <Input
                id="campaign-budget"
                type="number"
                min={1}
                {...form.register("totalBudget", { valueAsNumber: true })}
                aria-invalid={!!form.formState.errors.totalBudget}
              />
            </Field>
          </div>

          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Field
                id="campaign-status"
                label="Status"
                error={form.formState.errors.status?.message}
              >
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="campaign-status"
                    aria-invalid={!!form.formState.errors.status}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["draft", "active", "paused", "completed"] as const).map(
                      (status) => (
                        <SelectItem key={status} value={status} className="capitalize">
                          {status}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="campaign-starts-at"
              label="Starts at"
              error={form.formState.errors.startsAt?.message}
            >
              <Input
                id="campaign-starts-at"
                type="datetime-local"
                {...form.register("startsAt")}
                aria-invalid={!!form.formState.errors.startsAt}
              />
            </Field>
            <Field
              id="campaign-ends-at"
              label="Ends at"
              error={form.formState.errors.endsAt?.message}
            >
              <Input
                id="campaign-ends-at"
                type="datetime-local"
                {...form.register("endsAt")}
                aria-invalid={!!form.formState.errors.endsAt}
              />
            </Field>
          </div>

          {mutationError ? (
            <p role="alert" className="text-sm text-destructive">
              {mutationError.message}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save campaign"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}
