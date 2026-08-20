import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deleteControlEntities,
  fetchControlFacets,
  fetchControlInvestors,
  fetchControlStartups,
  setDirectoryState,
} from "./query.server";


const listSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(100).default(25),
  q: z.string().optional(),
  status: z.enum(["all", "published", "unpublished"]).optional(),
  facet: z.string().optional(),
  type: z.string().optional(),
  stage: z.string().optional(),
  country: z.string().optional(),
  updated: z.enum(["any", "7d", "30d", "90d"]).optional(),
  sort: z.enum(["updated_desc", "updated_asc", "name_asc", "name_desc"]).optional(),
});

const publishSchema = z.object({
  entity: z.enum(["startup", "investor"]),
  ids: z.array(z.string().uuid()).min(1).max(100),
  state: z.enum(["published", "unpublished"]),
});

export const listControlStartups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSchema.parse(d))
  .handler(async ({ data, context }) => fetchControlStartups(context.supabase, data));

export const listControlInvestors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSchema.parse(d))
  .handler(async ({ data, context }) => fetchControlInvestors(context.supabase, data));

export const listControlFacets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => fetchControlFacets(context.supabase));

export const setControlDirectoryState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => publishSchema.parse(d))
  .handler(async ({ data, context }) =>
    setDirectoryState(
      context.supabase,
      data.entity === "startup" ? "startups" : "investors",
      data.ids,
      data.state,
    ),
  );

const deleteSchema = z.object({
  entity: z.enum(["startup", "investor"]),
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export const deleteControlRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) =>
    deleteControlEntities(
      context.supabase,
      data.entity === "startup" ? "startups" : "investors",
      data.ids,
    ),
  );
