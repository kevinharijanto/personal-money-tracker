"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  useAccountGroups,
  useCategories,
  useHouseholds,
  useTransactions,
} from "@/hooks/useApi";
import { transactionService } from "@/services/apiService";
import { useHousehold } from "@/contexts/HouseholdContext";
import {
  useThemePreference,
  type ThemePalette,
} from "@/hooks/useThemePreference";

type Account = {
  id: string;
  name: string;
  currency: string;
  balance: string;
  scope: "HOUSEHOLD" | "PERSONAL";
};

type AccountGroup = {
  id: string;
  name: string;
  kind?: string | null;
  accounts: Account[];
};

type Category = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
};

type TransactionRecord = {
  id: string;
  date: string;
  description?: string | null;
  amount: string;
  type: string;
  category?: { name?: string | null };
  account?: { name?: string | null; currency?: string | null };
};

type TransactionPayload = {
  amount: string;
  type: "INCOME" | "EXPENSE";
  accountId: string;
  categoryId: string;
  description?: string;
};

type TabKey = "dashboard" | "accounts" | "transactions";
type ExpenseRange = "day" | "week" | "month" | "year";

const expenseRanges: { value: ExpenseRange; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

const tabItems: { key: TabKey; label: string; helper: string }[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    helper: "High-level health of your money.",
  },
  {
    key: "accounts",
    label: "Accounts",
    helper: "All households groups and balances.",
  },
  {
    key: "transactions",
    label: "Transactions",
    helper: "Latest activity across every account.",
  },
];

const MAX_RECENT = 8;
const CHART_COLORS = [
  "#38bdf8",
  "#a855f7",
  "#f97316",
  "#10b981",
  "#f43f5e",
  "#eab308",
  "#6366f1",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
] as const;

const numberFrom = (value: string | number | null | undefined) => {
  if (typeof value === "number") return value;
  const parsed = value ? parseFloat(value) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatCurrency = (value: number, currency = "IDR") => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
};

const formatDate = (input?: string | null) => {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const friendlyLabel = (value?: string | null) => {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

type ExpenseSlice = {
  category: string;
  amount: number;
  color: string;
};

const getRangeStart = (range: ExpenseRange) => {
  const now = new Date();
  if (range === "day") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (range === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (range === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(now.getFullYear(), 0, 1);
};

export default function Dashboard() {
  const { householdId, setHouseholdId } = useHousehold();
  const { data: households, loading: householdsLoading } = useHouseholds();
  const {
    data: accountGroupsData,
    loading: groupsLoading,
    error: groupsError,
    refetch: refetchGroups,
  } = useAccountGroups();
  const accountGroups = accountGroupsData as AccountGroup[] | null;
  const {
    data: transactionsData,
    loading: transactionsLoading,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useTransactions();
  const transactionsList = transactionsData as TransactionRecord[] | null;
  const { data: categoriesData, loading: categoriesLoading } = useCategories();
  const categories = categoriesData as Category[] | null;
  const { theme, palette, toggleTheme } = useThemePreference();
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [expenseRange, setExpenseRange] = useState<ExpenseRange>("month");

  useEffect(() => {
    if (households && households.length > 0 && !householdId) {
      setHouseholdId(households[0].id);
    }
  }, [households, householdId, setHouseholdId]);

  const allAccounts = useMemo(
    () => (accountGroups ?? []).flatMap((group) => group.accounts),
    [accountGroups],
  );
  const primaryCurrency = allAccounts[0]?.currency ?? "IDR";

  const totalBalance = useMemo(() => {
    return (accountGroups ?? []).reduce((sum, group) => {
      const groupTotal = group.accounts.reduce(
        (inner, account) => inner + numberFrom(account.balance),
        0,
      );
      return sum + groupTotal;
    }, 0);
  }, [accountGroups]);

  const totals = {
    totalBalance,
    accountCount: allAccounts.length,
    groupCount: accountGroups?.length ?? 0,
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const showAccountsSection = activeTab === "accounts";
  const showTransactionsSection = activeTab === "transactions";

  const handleTransactionSubmit = async (payload: TransactionPayload) => {
    if (!householdId) {
      throw new Error("Pick a household first.");
    }

    await transactionService.create(householdId, payload);
    await Promise.all([refetchGroups(), refetchTransactions()]);
  };

  const disableModalTrigger =
    !householdId || !allAccounts.length || groupsLoading || categoriesLoading;

  const expenseReport = useMemo(() => {
    const transactions = transactionsList ?? [];
    if (!transactions.length) {
      return { total: 0, slices: [] as ExpenseSlice[] };
    }

    const rangeStart = getRangeStart(expenseRange);
    const filtered = transactions.filter((txn) => {
      if (txn.type !== "EXPENSE") return false;
      if (!txn.date) return false;
      const txnDate = new Date(txn.date);
      return txnDate >= rangeStart;
    });

    if (!filtered.length) {
      return { total: 0, slices: [] as ExpenseSlice[] };
    }

    const totalsByCategory = filtered.reduce<Record<string, ExpenseSlice>>(
      (acc, txn) => {
        const amount = Math.abs(numberFrom(txn.amount));
        const key = txn.category?.name ?? "Uncategorized";

        if (!acc[key]) {
          acc[key] = {
            category: key,
            amount: 0,
            color:
              CHART_COLORS[
                Object.keys(acc).length % CHART_COLORS.length
              ] || CHART_COLORS[0],
          };
        }

        acc[key].amount += amount;
        return acc;
      },
      {},
    );

    const slices = Object.values(totalsByCategory).sort(
      (a, b) => b.amount - a.amount,
    );
    const total = slices.reduce((sum, slice) => sum + slice.amount, 0);

    return { total, slices };
  }, [transactionsList, expenseRange]);

  return (
    <div
      style={{
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        minHeight: "100vh",
        background: palette.background,
        color: palette.text,
        transition: "background 0.3s ease, color 0.3s ease",
      }}
    >
      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "20px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: "14px", color: palette.subtle }}>
            Web Console
          </p>
          <h1 style={{ margin: "4px 0 8px", fontSize: "28px" }}>
            Personal Money Tracker
          </h1>
          <p style={{ margin: 0, color: palette.muted }}>
            Keep an eye on household cash while the mobile app handles the
            day-to-day onboarding.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <label style={{ fontSize: "14px", color: palette.muted }}>
            Household
            <select
              value={householdId ?? ""}
              onChange={(event) => setHouseholdId(event.target.value || null)}
              disabled={householdsLoading || !households?.length}
              style={{
                display: "block",
                marginTop: "4px",
                padding: "8px 12px",
                minWidth: "220px",
                borderRadius: "8px",
                border: `1px solid ${palette.gridBorder}`,
                background: palette.inputBg,
                color: palette.text,
              }}
            >
              {householdsLoading && <option>Loading...</option>}
              {!householdsLoading && households?.length === 0 && (
                <option>No household</option>
              )}
              {!householdsLoading &&
                households?.map((household) => (
                  <option key={household.id} value={household.id}>
                    {household.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            onClick={toggleTheme}
            style={{
              padding: "10px 16px",
              borderRadius: "999px",
              border: `1px solid ${palette.gridBorder}`,
              background: palette.card,
              color: palette.text,
              cursor: "pointer",
            }}
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={disableModalTrigger}
            style={{
              padding: "12px 18px",
              borderRadius: "999px",
              border: "none",
              backgroundColor: disableModalTrigger
                ? palette.buttonMuted
                : palette.button,
              color: palette.buttonText,
              cursor: disableModalTrigger ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            New Transaction
          </button>
        </div>
      </section>

      {!householdId && !householdsLoading && (
        <div
          style={{
            padding: "16px",
            borderRadius: "12px",
            border: `1px solid ${palette.warningBorder}`,
            background: palette.warningBg,
            color: palette.danger,
          }}
        >
          No household selected. Pick one above or add it from the mobile app.
        </div>
      )}

      {disableModalTrigger && householdId && !groupsLoading && (
        <p style={{ margin: "-12px 0 8px", color: palette.subtle, fontSize: "13px" }}>
          Add an account group + account through the API or mobile app to start
          logging transactions here.
        </p>
      )}

      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <nav
          aria-label="Primary navigation"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            background: palette.surfaceMuted,
            borderRadius: "999px",
            padding: "6px",
          }}
        >
          {tabItems.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  border: "none",
                  borderRadius: "999px",
                  padding: "10px 18px",
                  cursor: "pointer",
                  backgroundColor: isActive ? palette.button : "transparent",
                  color: isActive ? palette.buttonText : palette.text,
                  fontWeight: isActive ? 600 : 500,
                  transition: "background 0.2s ease, color 0.2s ease",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
        <p style={{ margin: 0, color: palette.muted }}>
          {tabItems.find((tab) => tab.key === activeTab)?.helper}
        </p>
      </section>

      {activeTab === "dashboard" && (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            <SummaryTile
              label="Total Balance"
              value={formatCurrency(totals.totalBalance, primaryCurrency)}
              palette={palette}
            />
            <SummaryTile
              label="Account Groups"
              value={`${totals.groupCount}`}
              helper="Active in this household"
              palette={palette}
            />
            <SummaryTile
              label="Accounts"
              value={`${totals.accountCount}`}
              helper="Visible to you"
              palette={palette}
            />
          </section>

          <ExpenseReport
            palette={palette}
            expenseRange={expenseRange}
            onRangeChange={setExpenseRange}
            report={expenseReport}
          />
        </>
      )}

      {showAccountsSection && (
        <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>
              {activeTab === "accounts" ? "Accounts" : "Account Groups"}
            </h2>
            <p style={{ margin: 0, color: palette.muted }}>
              {activeTab === "accounts"
                ? "Everything you can spend from, grouped by household and ownership."
                : "Quick snapshot of banks, cards, and cash groupings."}
            </p>
          </div>
          <button
            onClick={() => refetchGroups()}
            disabled={groupsLoading}
            style={{
              padding: "8px 14px",
              borderRadius: "999px",
              border: `1px solid ${palette.gridBorder}`,
              background: palette.card,
              color: palette.text,
              cursor: groupsLoading ? "wait" : "pointer",
            }}
          >
            {groupsLoading ? "Syncing..." : "Refresh"}
          </button>
        </div>

        {groupsError && (
          <div
            style={{
              padding: "12px",
              borderRadius: "12px",
              border: `1px solid ${palette.warningBorder}`,
              background: palette.warningBg,
              color: palette.danger,
            }}
          >
            {groupsError}
          </div>
        )}

        {groupsLoading && !(accountGroups && accountGroups.length) && (
          <div
            style={{
              padding: "20px",
              borderRadius: "16px",
              border: `1px dashed ${palette.gridBorder}`,
              color: palette.muted,
            }}
          >
            Loading account groups for this household...
          </div>
        )}

        {!groupsLoading && (!accountGroups || accountGroups.length === 0) && (
          <div
            style={{
              padding: "20px",
              borderRadius: "16px",
              border: `1px dashed ${palette.gridBorder}`,
              color: palette.muted,
            }}
          >
            Nothing to show yet. Use the mobile app (or API) to create your first
            account group and accounts.
          </div>
        )}

        {accountGroups && accountGroups.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "18px",
            }}
          >
            {accountGroups.map((group) => (
              <AccountGroupCard key={group.id} group={group} palette={palette} />
            ))}
          </div>
        )}
      </section>
      )}

      {showTransactionsSection && (
        <RecentTransactions
          transactions={transactionsList ?? []}
          loading={transactionsLoading}
          error={transactionsError}
          onRefresh={refetchTransactions}
          palette={palette}
        />
      )}

      <TransactionModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        accounts={allAccounts}
        categories={categories ?? []}
        loading={groupsLoading || categoriesLoading}
        onSubmit={handleTransactionSubmit}
        palette={palette}
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  helper,
  palette,
}: {
  label: string;
  value: string;
  helper?: string;
  palette: ThemePalette;
}) {
  return (
    <div
      style={{
        borderRadius: "16px",
        border: `1px solid ${palette.border}`,
        padding: "20px",
        background: palette.card,
      }}
    >
      <p style={{ margin: 0, fontSize: "13px", color: palette.subtle }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontSize: "26px", fontWeight: 600 }}>
        {value}
      </p>
      {helper && (
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: palette.subtle }}>
          {helper}
        </p>
      )}
    </div>
  );
}

function AccountGroupCard({
  group,
  palette,
}: {
  group: AccountGroup;
  palette: ThemePalette;
}) {
  const currency = group.accounts[0]?.currency ?? "IDR";
  const groupTotal = group.accounts.reduce(
    (sum, account) => sum + numberFrom(account.balance),
    0,
  );

  return (
    <div
      style={{
        borderRadius: "18px",
        border: `1px solid ${palette.border}`,
        padding: "18px",
        background: palette.card,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: "13px", color: palette.subtle }}>Group</p>
          <h3 style={{ margin: "4px 0 2px" }}>{group.name}</h3>
          {group.kind && (
            <p style={{ margin: 0, color: palette.subtle, fontSize: "13px" }}>
              {friendlyLabel(group.kind)}
            </p>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: palette.subtle,
            }}
          >
            Total
          </p>
          <p style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>
            {formatCurrency(groupTotal, currency)}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {group.accounts.length > 0 ? (
          group.accounts.map((account) => (
            <div
              key={account.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px",
                borderRadius: "14px",
                background: palette.surfaceMuted,
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{account.name}</p>
                <p style={{ margin: 0, fontSize: "13px", color: palette.subtle }}>
                  {account.scope === "PERSONAL" ? "Personal" : "Household"}
                </p>
              </div>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {formatCurrency(numberFrom(account.balance), account.currency)}
              </p>
            </div>
          ))
        ) : (
          <div
            style={{
              padding: "12px",
              borderRadius: "14px",
              border: `1px dashed ${palette.gridBorder}`,
              textAlign: "center",
              color: palette.subtle,
            }}
          >
            No accounts in this group yet.
          </div>
        )}
      </div>
    </div>
  );
}

type RecentTransactionsProps = {
  transactions: TransactionRecord[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  palette: ThemePalette;
};

function RecentTransactions({
  transactions,
  loading,
  error,
  onRefresh,
  palette,
}: RecentTransactionsProps) {
  const hasRows = transactions && transactions.length > 0;

  return (
    <section
      style={{
        borderRadius: "18px",
        border: `1px solid ${palette.border}`,
        background: palette.card,
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Recent Activity</h2>
          <p style={{ margin: 0, color: palette.muted }}>
            Latest {Math.min(transactions.length, MAX_RECENT)} posts
          </p>
        </div>
        <button
          onClick={() => onRefresh()}
          disabled={loading}
          style={{
            padding: "8px 14px",
            borderRadius: "999px",
            border: `1px solid ${palette.gridBorder}`,
            background: palette.card,
            color: palette.text,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "12px",
            borderRadius: "12px",
            border: `1px solid ${palette.warningBorder}`,
            background: palette.warningBg,
            color: palette.danger,
          }}
        >
          {error}
        </div>
      )}

      {loading && !hasRows && <p>Loading transactions...</p>}

      {!loading && !hasRows && (
        <p style={{ margin: 0, color: palette.subtle }}>
          Nothing logged yet. Use the button above to add the first entry.
        </p>
      )}

      {hasRows && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "560px",
            }}
          >
            <thead>
              <tr
                style={{ textAlign: "left", color: palette.subtle, fontSize: "13px" }}
              >
                <th style={{ padding: "8px" }}>Date</th>
                <th style={{ padding: "8px" }}>Account</th>
                <th style={{ padding: "8px" }}>Category</th>
                <th style={{ padding: "8px" }}>Description</th>
                <th style={{ padding: "8px", textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, MAX_RECENT).map((txn) => {
                const amount = numberFrom(txn.amount);
                const amountColor = amount >= 0 ? palette.success : palette.danger;
                const currency = txn.account?.currency ?? "IDR";
                return (
                  <tr
                    key={txn.id}
                    style={{ borderTop: `1px solid ${palette.tableStripe}` }}
                  >
                    <td style={{ padding: "10px 8px" }}>
                      {formatDate(txn.date)}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {txn.account?.name ?? "-"}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {txn.category?.name ?? "-"}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {txn.description?.trim() || "-"}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        textAlign: "right",
                        color: amountColor,
                        fontWeight: 600,
                      }}
                    >
                      {amount >= 0 ? "+" : "-"}
                      {formatCurrency(Math.abs(amount), currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type ExpenseReportProps = {
  palette: ThemePalette;
  expenseRange: ExpenseRange;
  onRangeChange: (value: ExpenseRange) => void;
  report: { total: number; slices: ExpenseSlice[] };
};

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

function ExpenseReport({
  palette,
  expenseRange,
  onRangeChange,
  report,
}: ExpenseReportProps) {
  const { total, slices } = report;
  const gradient = getGradient(slices, total, palette);

  return (
    <section
      style={{
        borderRadius: "18px",
        border: `1px solid ${palette.border}`,
        background: palette.card,
        padding: "20px",
        display: "flex",
        flexWrap: "wrap",
        gap: "24px",
        alignItems: "center",
      }}
    >
      <div style={{ flex: "1 1 220px", minWidth: "220px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Expense Report</h2>
            <p style={{ margin: 0, color: palette.muted }}>
              {total > 0
                ? "Expense shares by category."
                : "No expenses recorded in this range."}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: "6px",
              background: palette.surfaceMuted,
              borderRadius: "999px",
              padding: "4px",
            }}
          >
            {expenseRanges.map((range) => {
              const active = expenseRange === range.value;
              return (
                <button
                  key={range.value}
                  type="button"
                  onClick={() => onRangeChange(range.value)}
                  style={{
                    border: "none",
                    borderRadius: "999px",
                    padding: "6px 12px",
                    cursor: "pointer",
                    backgroundColor: active ? palette.button : "transparent",
                    color: active ? palette.buttonText : palette.text,
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {range.label}
                </button>
              );
            })}
          </div>
        </div>
        <div
          style={{
            width: "220px",
            height: "220px",
            borderRadius: "50%",
            background: gradient,
            position: "relative",
            margin: "0 auto",
            boxShadow: "0 10px 30px rgba(15,23,42,0.45)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "32px",
              borderRadius: "50%",
              background: palette.card,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "12px",
            }}
          >
            <p style={{ margin: 0, color: palette.subtle, fontSize: "13px" }}>
              Total
            </p>
            <strong style={{ fontSize: "20px" }}>
              {formatCurrency(total, "IDR")}
            </strong>
            <p style={{ margin: "4px 0 0", color: palette.muted, fontSize: "12px" }}>
              {expenseRange.charAt(0).toUpperCase() + expenseRange.slice(1)}
            </p>
          </div>
        </div>
      </div>
      <div style={{ flex: "2 1 300px" }}>
        {total === 0 && (
          <p style={{ margin: 0, color: palette.subtle }}>
            No expenses were recorded for this time range.
          </p>
        )}
        {total > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {slices.map((slice) => {
              const percentage = slice.amount / total;
              return (
                <li
                  key={slice.category}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: `1px solid ${palette.surfaceMuted}`,
                    padding: "10px 0",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background: slice.color,
                        display: "inline-block",
                      }}
                    />
                    <div>
                      <strong>{slice.category}</strong>
                      <p style={{ margin: 0, color: palette.subtle }}>
                        {formatPercent(percentage)}
                      </p>
                    </div>
                  </div>
                  <strong>{formatCurrency(slice.amount, "IDR")}</strong>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

const getGradient = (
  slices: ExpenseSlice[],
  total: number,
  palette: ThemePalette,
) => {
  if (!slices.length || total === 0) {
    return palette.surfaceMuted;
  }
  let cumulative = 0;
  const stops = slices.map((slice) => {
    const start = (cumulative / total) * 100;
    cumulative += slice.amount;
    const end = (cumulative / total) * 100;
    return `${slice.color} ${start}% ${end}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
};

type TransactionModalProps = {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  loading: boolean;
  onSubmit: (payload: TransactionPayload) => Promise<void>;
  palette: ThemePalette;
};

type TransactionFormState = TransactionPayload;

const createDefaultTransactionForm = (): TransactionFormState => ({
  amount: "",
  type: "EXPENSE",
  accountId: "",
  categoryId: "",
  description: "",
});

function TransactionModal({
  open,
  onClose,
  accounts,
  categories,
  loading,
  onSubmit,
  palette,
}: TransactionModalProps) {
  const [form, setForm] = useState<TransactionFormState>(() =>
    createDefaultTransactionForm(),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === form.type),
    [categories, form.type],
  );

  useEffect(() => {
    if (!open) {
      setForm(createDefaultTransactionForm());
      setError(null);
      setSaving(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !accounts.length) return;
    setForm((prev) => {
      const accountStillVisible = accounts.some(
        (account) => account.id === prev.accountId,
      );
      if (prev.accountId && accountStillVisible) {
        return prev;
      }
      return { ...prev, accountId: accounts[0].id };
    });
  }, [accounts, open]);

  useEffect(() => {
    if (!open) return;
    if (!filteredCategories.length) {
      setForm((prev) => ({ ...prev, categoryId: "" }));
      return;
    }
    setForm((prev) => {
      if (
        prev.categoryId &&
        filteredCategories.some((category) => category.id === prev.categoryId)
      ) {
        return prev;
      }
      return { ...prev, categoryId: filteredCategories[0].id };
    });
  }, [filteredCategories, open]);

  if (!open) return null;

  const missingAccounts = accounts.length === 0;
  const missingCategories = filteredCategories.length === 0;
  const submitDisabled =
    saving || missingAccounts || missingCategories || !form.amount;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitDisabled) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        description: form.description?.trim() || undefined,
      });
      setForm(createDefaultTransactionForm());
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save transaction";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: palette.overlay,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 30,
        padding: "16px",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "min(480px, 100%)",
          background: palette.card,
          color: palette.text,
          borderRadius: "24px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, color: palette.subtle, fontSize: "13px" }}>
              Quick post
            </p>
            <h2 style={{ margin: "2px 0 0" }}>New Transaction</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              border: "none",
              background: "transparent",
              fontSize: "18px",
              cursor: saving ? "not-allowed" : "pointer",
              color: palette.subtle,
            }}
            aria-label="Close"
          >
            x
          </button>
        </div>

        {loading && (
          <p style={{ margin: 0, color: palette.subtle }}>
            Fetching accounts and categories...
          </p>
        )}

        {missingAccounts && !loading && (
          <p style={{ margin: 0, color: palette.danger }}>
            No accounts detected. Create one via the app first.
          </p>
        )}

        {missingCategories && !loading && (
          <p style={{ margin: 0, color: palette.danger }}>
            No categories found for this type yet.
          </p>
        )}

        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          Amount
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, amount: event.target.value }))
            }
            required
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              border: `1px solid ${palette.gridBorder}`,
              background: palette.inputBg,
              color: palette.text,
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          Type
          <select
            value={form.type}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                type: event.target.value as "INCOME" | "EXPENSE",
              }))
            }
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              border: `1px solid ${palette.gridBorder}`,
              background: palette.inputBg,
              color: palette.text,
            }}
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          Account
          <select
            value={form.accountId}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, accountId: event.target.value }))
            }
            disabled={missingAccounts}
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              border: `1px solid ${palette.gridBorder}`,
              background: palette.inputBg,
              color: palette.text,
            }}
          >
            {accounts.length === 0 ? (
              <option value="">No accounts available</option>
            ) : (
              accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))
            )}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          Category
          <select
            value={form.categoryId}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, categoryId: event.target.value }))
            }
            disabled={missingCategories}
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              border: `1px solid ${palette.gridBorder}`,
              background: palette.inputBg,
              color: palette.text,
            }}
          >
            {filteredCategories.length === 0 ? (
              <option value="">No categories available</option>
            ) : (
              filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))
            )}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          Description
          <input
            type="text"
            value={form.description ?? ""}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder="Optional note"
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              border: `1px solid ${palette.gridBorder}`,
              background: palette.inputBg,
              color: palette.text,
            }}
          />
        </label>

        {error && (
          <p style={{ color: palette.danger, margin: "6px 0 0" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={submitDisabled}
          style={{
            marginTop: "6px",
            padding: "12px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: submitDisabled ? palette.buttonMuted : palette.button,
            color: palette.buttonText,
            cursor: submitDisabled ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {saving ? "Saving..." : "Save Transaction"}
        </button>
      </form>
    </div>
  );
}
