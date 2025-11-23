import { z } from "zod";

export const createBankSchema = z.object({
  name: z.string().min(1, "name is required").max(100),
});

export const upsertPocketSchema = z.object({
  name: z.string().min(1).max(100),
  bankId: z.string().min(1),
});
export const updatePocketSchema = upsertPocketSchema.partial();

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["INCOME", "EXPENSE"]).default("EXPENSE"),
});

export const createSubcategorySchema = z.object({
  name: z.string().min(1).max(100),
  parentCategoryId: z.string().min(1),
  // Optional type allows callers to explicitly set or mirror parent type
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
});

export const createTxnSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER_IN", "TRANSFER_OUT"]),
  pocketId: z.string().min(1),
  categoryId: z.string().min(1),
  description: z.string().optional().default(""),
  date: z.string().datetime().optional(), // optional ISO string override
});

export const transferSchema = z.object({
  fromPocketId: z.string().min(1),
  toPocketId: z.string().min(1),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  description: z.string().optional().default(""),
  date: z.string().datetime().optional(),
  // if provided true, we enforce both pockets are in the same bank
  mustBeSameBank: z.boolean().optional().default(false),
  // optional category to use; if not provided we will use/create "Transfer"
  categoryId: z.string().optional(),
});
// Users and Memberships + Transaction update schemas
export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export const createMembershipSchema = z.object({
  userId: z.string().min(1),
  householdId: z.string().min(1),
  role: z.enum(["OWNER", "MEMBER"]).optional().default("MEMBER"),
});

export const updateTxnSchema = createTxnSchema.partial();

// Tenancy-aware schemas (v2)
export const createHouseholdSchema = z.object({
  name: z.string().min(1).max(100),
});

export const createAccountGroupSchema = z.object({
  name: z.string().min(1).max(100),
  kind: z
    .enum(["CASH", "CARD", "BANK_ACCOUNTS", "CREDIT_CARDS", "LOANS", "OTHER"])
    .optional(),
  householdId: z.string().min(1),
});

export const upsertAccountSchema = z
  .object({
    name: z.string().min(1).max(100),
    groupId: z.string().min(1),
    currency: z.string().min(1).default("IDR"),
    startingBalance: z
      .union([z.string(), z.number()])
      .transform((v) => String(v))
      .optional()
      .default("0"),
    isArchived: z.boolean().optional().default(false),
    scope: z.enum(["HOUSEHOLD", "PERSONAL"]).optional().default("HOUSEHOLD"),
    ownerUserId: z.string().optional(),
  })
  .refine(
    (d) => d.scope !== "PERSONAL" || !!d.ownerUserId,
    {
      message: "ownerUserId is required when scope is PERSONAL",
      path: ["ownerUserId"],
    }
  );

export const updateAccountSchema = upsertAccountSchema.partial();

export const createTxnSchemaV2 = z.object({
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER_IN", "TRANSFER_OUT"]),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  description: z.string().optional().default(""),
  date: z.string().datetime().optional(),
});

export const transferSchemaV2 = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  description: z.string().optional().default(""),
  date: z.string().datetime().optional(),
  mustBeSameGroup: z.boolean().optional().default(false),
  categoryId: z.string().optional(),
});
