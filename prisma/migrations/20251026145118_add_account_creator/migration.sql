-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "startingBalance" DECIMAL NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT NOT NULL DEFAULT 'HOUSEHOLD',
    "ownerUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Account_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AccountGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Account_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Account_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- For existing accounts, we need to set a createdById value
-- We'll use the household owner as the creator for existing accounts
INSERT INTO "new_Account" ("createdAt", "currency", "groupId", "id", "isArchived", "name", "ownerUserId", "scope", "startingBalance", "updatedAt", "createdById")
SELECT
    a."createdAt",
    a."currency",
    a."groupId",
    a."id",
    a."isArchived",
    a."name",
    a."ownerUserId",
    a."scope",
    a."startingBalance",
    a."updatedAt",
    COALESCE(
        m.userId,
        (SELECT userId FROM Membership WHERE householdId = ag.householdId AND role = 'OWNER' LIMIT 1),
        (SELECT id FROM "User" LIMIT 1) -- Fallback to first user if no owner found
    ) as "createdById"
FROM "Account" a
LEFT JOIN "AccountGroup" ag ON a."groupId" = ag."id"
LEFT JOIN "Membership" m ON m.householdId = ag.householdId AND m.role = 'OWNER';

DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE INDEX "Account_groupId_idx" ON "Account"("groupId");
CREATE INDEX "Account_ownerUserId_idx" ON "Account"("ownerUserId");
CREATE INDEX "Account_createdById_idx" ON "Account"("createdById");
CREATE UNIQUE INDEX "Account_groupId_name_key" ON "Account"("groupId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
