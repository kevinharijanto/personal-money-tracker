import "dotenv/config";
import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";

const SQLITE_PATH = "./dev.db";
const BATCH_SIZE = 500;

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith("file:")) {
  throw new Error(
    "Set DATABASE_URL to your Neon instance before running this script.",
  );
}

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const neon = new PrismaClient();

type CopyPlan = {
  label: string;
  table: string;
  insert: (records: any[]) => Promise<void>;
  dateFields?: string[];
  decimalFields?: string[];
  booleanFields?: string[];
};

const fetchAll = (table: string) => {
  return sqlite.prepare(`SELECT * FROM "${table}"`).all();
};

const applyTransforms = (
  rows: any[],
  {
    dateFields = [],
    decimalFields = [],
    booleanFields = [],
  }: { dateFields?: string[]; decimalFields?: string[]; booleanFields?: string[] },
) =>
  rows.map((row) => {
    const updated: Record<string, any> = { ...row };
    for (const field of dateFields) {
      if (updated[field] === null || updated[field] === undefined) continue;
      const value = updated[field];
      updated[field] =
        typeof value === "number" ? new Date(value) : new Date(String(value));
    }
    for (const field of decimalFields) {
      if (updated[field] === null || updated[field] === undefined) continue;
      updated[field] = String(updated[field]);
    }
    for (const field of booleanFields) {
      if (updated[field] === null || updated[field] === undefined) continue;
      const value = updated[field];
      updated[field] =
        typeof value === "boolean" ? value : Boolean(Number(value));
    }
    return updated;
  });

const insertInChunks = async (
  records: any[],
  inserter: (chunk: any[]) => Promise<unknown>,
) => {
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    if (!chunk.length) continue;
    await inserter(chunk);
  }
};

const plans: CopyPlan[] = [
  {
    label: "Households",
    table: "Household",
    dateFields: ["createdAt", "updatedAt"],
    insert: (records) =>
      insertInChunks(records, (chunk) =>
        neon.household.createMany({ data: chunk, skipDuplicates: true }),
      ),
  },
  {
    label: "Users",
    table: "User",
    dateFields: ["createdAt", "updatedAt", "emailVerified"],
    insert: (records) =>
      insertInChunks(records, (chunk) =>
        neon.user.createMany({ data: chunk, skipDuplicates: true }),
      ),
  },
  {
    label: "Memberships",
    table: "Membership",
    dateFields: ["createdAt", "updatedAt"],
    insert: (records) =>
      insertInChunks(records, (chunk) =>
        neon.membership.createMany({ data: chunk, skipDuplicates: true }),
      ),
  },
  {
    label: "Invitations",
    table: "Invitation",
    dateFields: ["expiresAt", "createdAt", "updatedAt"],
    insert: (records) =>
      insertInChunks(records, (chunk) =>
        neon.invitation.createMany({ data: chunk, skipDuplicates: true }),
      ),
  },
  {
    label: "Account groups",
    table: "AccountGroup",
    dateFields: ["createdAt", "updatedAt"],
    insert: (records) =>
      insertInChunks(records, (chunk) =>
        neon.accountGroup.createMany({ data: chunk, skipDuplicates: true }),
      ),
  },
  {
    label: "Accounts",
    table: "Account",
    dateFields: ["createdAt", "updatedAt"],
    decimalFields: ["startingBalance"],
    booleanFields: ["isArchived"],
    insert: (records) =>
      insertInChunks(records, (chunk) =>
        neon.account.createMany({ data: chunk, skipDuplicates: true }),
      ),
  },
  {
    label: "Categories",
    table: "Category",
    dateFields: ["createdAt", "updatedAt"],
    insert: (records) =>
      insertInChunks(records, (chunk) =>
        neon.category.createMany({ data: chunk, skipDuplicates: true }),
      ),
  },
  {
    label: "Transfer groups",
    table: "TransferGroup",
    dateFields: ["createdAt", "updatedAt"],
    insert: (records) =>
      insertInChunks(records, (chunk) =>
        neon.transferGroup.createMany({ data: chunk, skipDuplicates: true }),
      ),
  },
  {
    label: "Transactions",
    table: "Transaction",
    dateFields: ["date", "createdAt", "updatedAt"],
    decimalFields: ["amount"],
    insert: (records) =>
      insertInChunks(records, (chunk) =>
        neon.transaction.createMany({ data: chunk, skipDuplicates: true }),
      ),
  },
  {
    label: "Quick logins",
    table: "QuickLogin",
    dateFields: ["createdAt", "updatedAt"],
    booleanFields: ["enabled"],
    insert: (records) =>
      insertInChunks(records, (chunk) =>
        neon.quickLogin.createMany({ data: chunk, skipDuplicates: true }),
      ),
  },
  {
    label: "Auth accounts",
    table: "AuthAccount",
    insert: (records) =>
      insertInChunks(records, (chunk) =>
        neon.authAccount.createMany({ data: chunk, skipDuplicates: true }),
      ),
  },
  {
    label: "Sessions",
    table: "Session",
    dateFields: ["expires"],
    insert: (records) =>
      insertInChunks(records, (chunk) =>
        neon.session.createMany({ data: chunk, skipDuplicates: true }),
      ),
  },
  {
    label: "Verification tokens",
    table: "VerificationToken",
    insert: (records) =>
      insertInChunks(records, (chunk) =>
        neon.verificationToken.createMany({
          data: chunk,
          skipDuplicates: true,
        }),
      ),
  },
];

async function main() {
  console.log("Copying data from SQLite to Neon...");
  for (const plan of plans) {
    const rows = applyTransforms(fetchAll(plan.table), {
      dateFields: plan.dateFields,
      decimalFields: plan.decimalFields,
      booleanFields: plan.booleanFields,
    });
    if (!rows.length) {
      console.log(`- ${plan.label}: nothing to copy`);
      continue;
    }
    await plan.insert(rows);
    console.log(`- ${plan.label}: copied ${rows.length} rows`);
  }
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error("Failed to copy data:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    sqlite.close();
    await neon.$disconnect();
  });
