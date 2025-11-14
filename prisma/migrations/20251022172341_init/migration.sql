/*
  Warnings:

  - You are about to drop the column `balance` on the `Pocket` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pocket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pocket_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Pocket" ("bankId", "createdAt", "id", "name", "updatedAt") SELECT "bankId", "createdAt", "id", "name", "updatedAt" FROM "Pocket";
DROP TABLE "Pocket";
ALTER TABLE "new_Pocket" RENAME TO "Pocket";
CREATE INDEX "Pocket_bankId_idx" ON "Pocket"("bankId");
CREATE UNIQUE INDEX "Pocket_bankId_name_key" ON "Pocket"("bankId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
