import { z } from "zod";
import { TOPICS } from "../topics.js";

export const llmFactSchema = z.object({
  topic: z.enum(TOPICS),
  kind: z.enum(["open", "update", "resolve", "info"]),
  room: z.string().nullable().optional(),
  guest: z.string().nullable().optional(),
  summary: z.string().min(1),
  excerpt: z.string().min(1),
});

export const llmResponseSchema = z.object({
  facts: z.array(llmFactSchema),
});

export type LlmFact = z.infer<typeof llmFactSchema>;
