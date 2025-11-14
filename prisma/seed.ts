/**
 * Prisma seed script aligned with current schema.
 * Seeds: Two users (owner and member), Household, Memberships, AccountGroups, Accounts, Categories, and Transactions.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({ log: ["warn", "error"] });

async function clearData() {
  // Delete in order to satisfy foreign key constraints
  await prisma.transaction.deleteMany();
  await prisma.transferGroup.deleteMany();
  await prisma.account.deleteMany();
  await prisma.accountGroup.deleteMany();
  await prisma.category.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.household.deleteMany();
  await prisma.user.deleteMany();
}

async function seedData() {
  // Create household
  const household = await prisma.household.create({
    data: { name: "Test Household" },
  });

  // Create owner user
  const ownerPasswordHash = await bcrypt.hash("password123", 10);
  const owner = await prisma.user.create({
    data: {
      email: "owner@example.com",
      name: "Owner User",
      passwordHash: ownerPasswordHash,
    },
  });

  // Create member user
  const memberPasswordHash = await bcrypt.hash("password123", 10);
  const member = await prisma.user.create({
    data: {
      email: "member@example.com",
      name: "Member User",
      passwordHash: memberPasswordHash,
    },
  });

  // Create memberships
  await prisma.membership.create({
    data: {
      userId: owner.id,
      householdId: household.id,
      role: "OWNER",
    },
  });

  await prisma.membership.create({
    data: {
      userId: member.id,
      householdId: household.id,
      role: "MEMBER",
    },
  });

  // Create owner's account groups
  const ownerCashGroup = await prisma.accountGroup.create({
    data: {
      name: "Owner's Cash",
      kind: "CASH",
      householdId: household.id,
    },
  });

  const ownerBankGroup = await prisma.accountGroup.create({
    data: {
      name: "Owner's Bank",
      kind: "BANK_ACCOUNTS",
      householdId: household.id,
    },
  });

  // Create member's account groups
  const memberCashGroup = await prisma.accountGroup.create({
    data: {
      name: "Member's Cash",
      kind: "CASH",
      householdId: household.id,
    },
  });

  const memberEWalletGroup = await prisma.accountGroup.create({
    data: {
      name: "Member's E-Wallet",
      kind: "OTHER",
      householdId: household.id,
    },
  });

  // Create owner's accounts (mix of household and personal)
  const ownerWallet = await prisma.account.create({
    data: {
      name: "Owner's Wallet",
      groupId: ownerCashGroup.id,
      currency: "IDR",
      startingBalance: "100000",
      scope: "PERSONAL",
      ownerUserId: owner.id,
      createdById: owner.id,
    },
  });

  const ownerBankAccount = await prisma.account.create({
    data: {
      name: "Owner's Bank Account",
      groupId: ownerBankGroup.id,
      currency: "IDR",
      startingBalance: "5000000",
      scope: "PERSONAL",
      ownerUserId: owner.id,
      createdById: owner.id,
    },
  });

  const householdCash = await prisma.account.create({
    data: {
      name: "Household Cash",
      groupId: ownerCashGroup.id,
      currency: "IDR",
      startingBalance: "2000000",
      scope: "HOUSEHOLD",
      createdById: owner.id,
    },
  });

  // Create member's accounts (mix of household and personal)
  const memberWallet = await prisma.account.create({
    data: {
      name: "Member's Wallet",
      groupId: memberCashGroup.id,
      currency: "IDR",
      startingBalance: "50000",
      scope: "PERSONAL",
      ownerUserId: member.id,
      createdById: member.id,
    },
  });

  const memberEWallet = await prisma.account.create({
    data: {
      name: "Member's E-Wallet",
      groupId: memberEWalletGroup.id,
      currency: "IDR",
      startingBalance: "250000",
      scope: "PERSONAL",
      ownerUserId: member.id,
      createdById: member.id,
    },
  });

  // Create categories
  const categorySalary = await prisma.category.create({
    data: {
      name: "Salary",
      householdId: household.id,
    },
  });

  const categoryFood = await prisma.category.create({
    data: {
      name: "Food",
      householdId: household.id,
    },
  });

  const categoryTransport = await prisma.category.create({
    data: {
      name: "Transport",
      householdId: household.id,
    },
  });

  const categoryEntertainment = await prisma.category.create({
    data: {
      name: "Entertainment",
      householdId: household.id,
    },
  });

  // Create owner's transactions
  await prisma.transaction.createMany({
    data: [
      {
        amount: "10000000",
        type: "INCOME",
        accountId: ownerBankAccount.id,
        categoryId: categorySalary.id,
        description: "Owner's monthly salary",
        date: new Date("2024-01-01"),
      },
      {
        amount: "75000",
        type: "EXPENSE",
        accountId: ownerWallet.id,
        categoryId: categoryFood.id,
        description: "Owner's lunch",
        date: new Date("2024-01-02"),
      },
      {
        amount: "25000",
        type: "EXPENSE",
        accountId: ownerWallet.id,
        categoryId: categoryTransport.id,
        description: "Owner's bus fare",
        date: new Date("2024-01-03"),
      },
      {
        amount: "150000",
        type: "EXPENSE",
        accountId: ownerBankAccount.id,
        categoryId: categoryEntertainment.id,
        description: "Owner's movie tickets",
        date: new Date("2024-01-04"),
      },
    ],
  });

  // Create member's transactions
  await prisma.transaction.createMany({
    data: [
      {
        amount: "5000000",
        type: "INCOME",
        accountId: memberEWallet.id,
        categoryId: categorySalary.id,
        description: "Member's monthly salary",
        date: new Date("2024-01-01"),
      },
      {
        amount: "35000",
        type: "EXPENSE",
        accountId: memberWallet.id,
        categoryId: categoryFood.id,
        description: "Member's breakfast",
        date: new Date("2024-01-02"),
      },
      {
        amount: "50000",
        type: "EXPENSE",
        accountId: memberEWallet.id,
        categoryId: categoryTransport.id,
        description: "Member's ride-sharing",
        date: new Date("2024-01-03"),
      },
      {
        amount: "75000",
        type: "EXPENSE",
        accountId: memberEWallet.id,
        categoryId: categoryEntertainment.id,
        description: "Member's gaming subscription",
        date: new Date("2024-01-05"),
      },
    ],
  });

  // Create household transactions
  await prisma.transaction.createMany({
    data: [
      {
        amount: "1000000",
        type: "INCOME",
        accountId: householdCash.id,
        categoryId: categorySalary.id,
        description: "Household bonus",
        date: new Date("2024-01-01"),
      },
      {
        amount: "500000",
        type: "EXPENSE",
        accountId: householdCash.id,
        categoryId: categoryFood.id,
        description: "Grocery shopping",
        date: new Date("2024-01-06"),
      },
    ],
  });

  return { household, owner, member };
}

async function main() {
  console.log("Seeding database...");
  await clearData();
  const { household, owner, member } = await seedData();
  console.log("Seed complete:", { 
    household: household.id, 
    owner: owner.email,
    member: member.email
  });
  console.log("Login credentials:");
  console.log("Owner: owner@example.com / password123");
  console.log("Member: member@example.com / password123");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
