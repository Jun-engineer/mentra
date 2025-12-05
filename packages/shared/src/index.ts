/**
 * Shared domain contracts used by both the frontend and backend services.
 */
import { z } from "zod";

export const TenantIdSchema = z
  .string()
  .min(1, "Tenant ID is required")
  .brand("TenantId");
export type TenantId = z.infer<typeof TenantIdSchema>;

export const ManualStatusSchema = z.enum(["draft", "published"]);
export type ManualStatus = z.infer<typeof ManualStatusSchema>;

export const ManualSchema = z.object({
  manualId: z.string().uuid(),
  tenantId: TenantIdSchema,
  title: z.string().min(1),
  content: z.string().min(1),
  categoryId: z.string().optional(),
  status: ManualStatusSchema.default("draft"),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Manual = z.infer<typeof ManualSchema>;

export const CreateManualInputSchema = ManualSchema.pick({
  tenantId: true,
  title: true,
  content: true,
  categoryId: true,
  status: true
});
export type CreateManualInput = z.infer<typeof CreateManualInputSchema>;
