import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, ilike, lte, gte } from "drizzle-orm";
import { z } from "zod";

import { campaigns } from "@/server/db/schema";
import { getCampaignAdminDetail } from "@/server/domain/campaign-overview";
import { updateCampaignSafely } from "@/server/domain/campaign-update";
import {
  campaignFormSchema,
  campaignListInputSchema,
} from "@/shared/schemas/campaign";

import {
  adminProcedure,
  createTRPCRouter,
  creatorProcedure,
} from "../trpc";
import { toTRPCError } from "../domain-error";

export const campaignRouter = createTRPCRouter({
  listAdmin: adminProcedure
    .input(campaignListInputSchema)
    .query(async ({ ctx, input }) => {
      const filters = [
        input.search ? ilike(campaigns.title, `%${input.search}%`) : undefined,
        input.status ? eq(campaigns.status, input.status) : undefined,
      ].filter((filter) => filter !== undefined);
      const where = filters.length > 0 ? and(...filters) : undefined;
      const offset = (input.page - 1) * input.pageSize;
      const [items, totalRows] = await Promise.all([
        ctx.db
          .select()
          .from(campaigns)
          .where(where)
          .orderBy(desc(campaigns.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        ctx.db.select({ total: count() }).from(campaigns).where(where),
      ]);

      const total = totalRows[0]?.total ?? 0;

      return {
        items,
        page: input.page,
        pageSize: input.pageSize,
        total,
        pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
      };
    }),

  listActive: creatorProcedure.query(async ({ ctx }) => {
    const now = new Date();

    return ctx.db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.status, "active"),
          lte(campaigns.startsAt, now),
          gte(campaigns.endsAt, now),
        ),
      )
      .orderBy(desc(campaigns.createdAt));
  }),

  create: adminProcedure
    .input(campaignFormSchema)
    .mutation(async ({ ctx, input }) => {
      const [campaign] = await ctx.db
        .insert(campaigns)
        .values({
          ...input,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
        })
        .returning();

      return campaign;
    }),

  update: adminProcedure
    .input(z.object({ id: z.uuid(), values: campaignFormSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateCampaignSafely(ctx.db, input.id, {
          ...input.values,
          startsAt: new Date(input.values.startsAt),
          endsAt: new Date(input.values.endsAt),
        });
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  adminDetail: adminProcedure
    .input(z.object({ campaignId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const detail = await getCampaignAdminDetail(ctx.db, input.campaignId);

      if (!detail) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return detail;
    }),
});
