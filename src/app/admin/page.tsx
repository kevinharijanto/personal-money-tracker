"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type HouseholdSummary = {
  id: string;
  name: string | null;
  role: string;
};

type UserSummary = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  updatedAt: string;
  households: HouseholdSummary[];
};

export default function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const saved = window.localStorage.getItem("adminToken");
    if (saved) {
      setToken(saved);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUsers([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("adminToken");
    }
  }, []);

  const fetchUsers = useCallback(
    async (activeToken: string) => {
      setDataLoading(true);
      setDataError(null);
      setStatusMessage(null);
      try {
        const res = await fetch("/api/admin/users", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
          cache: "no-store",
        });

        if (res.status === 401) {
          logout();
          setDataError("Admin session expired. Please sign in again.");
          return;
        }

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error ?? "Failed to load users");
        }

        const payload = (await res.json()) as { users: UserSummary[] };
        setUsers(payload.users ?? []);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load users";
        setDataError(message);
      } finally {
        setDataLoading(false);
      }
    },
    [logout],
  );

  useEffect(() => {
    if (!token) return;
    fetchUsers(token);
  }, [token, fetchUsers]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setStatusMessage(null);
    setAuthLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Invalid password");
      }

      const data = await res.json();
      setToken(data.token);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("adminToken", data.token);
      }
      setPassword("");
      setStatusMessage("Signed in as admin.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign in failed";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async (user: UserSummary) => {
    if (!token) return;
    const newPassword = window.prompt(`Enter a new password for ${user.email}:`);
    if (!newPassword) {
      return;
    }

    setStatusMessage(null);
    setResettingUserId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      if (res.status === 401) {
        logout();
        setDataError("Admin session expired. Please sign in again.");
        return;
      }

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Reset failed");
      }

      setStatusMessage(`Password reset for ${user.email}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reset password";
      setDataError(message);
    } finally {
      setResettingUserId(null);
    }
  };

  const totalHouseholds = useMemo(() => {
    const set = new Set<string>();
    users.forEach((user) => {
      user.households.forEach((h) => set.add(h.id));
    });
    return set.size;
  }, [users]);

  const loggedIn = Boolean(token);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "2rem",
        background: "linear-gradient(180deg, #020617 0%, #0f172a 100%)",
        color: "#e2e8f0",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          backgroundColor: "#0f172a",
          borderRadius: "1rem",
          padding: "2rem",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.45)",
          border: "1px solid rgba(148,163,184,0.1)",
        }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "2rem" }}>Admin Dashboard</h1>
            <p style={{ margin: "0.25rem 0 0", color: "#94a3b8" }}>User management &amp; password resets</p>
          </div>
          {loggedIn && (
            <button
              onClick={logout}
              style={{
                backgroundColor: "transparent",
                color: "#f87171",
                border: "1px solid rgba(248,113,113,0.6)",
                borderRadius: "999px",
                padding: "0.5rem 1.25rem",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          )}
        </header>

        {!loggedIn && (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <span style={{ color: "#cbd5f5" }}>Admin Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter admin password"
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid rgba(148,163,184,0.3)",
                  backgroundColor: "#020617",
                  color: "#e2e8f0",
                }}
              />
            </label>
            {authError && (
              <div style={{ color: "#f87171", fontSize: "0.9rem" }}>
                {authError}
              </div>
            )}
            <button
              type="submit"
              disabled={authLoading}
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: authLoading ? "#475569" : "#22d3ee",
                color: authLoading ? "#cbd5f5" : "#0f172a",
                fontWeight: 600,
                cursor: authLoading ? "not-allowed" : "pointer",
                transition: "background-color 0.2s ease",
              }}
            >
              {authLoading ? "Signing in..." : "Access admin"}
            </button>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.9rem" }}>
              Use password <code style={{ backgroundColor: "#1e293b", padding: "0.15rem 0.35rem", borderRadius: "0.25rem" }}>Password123!</code> for now.
            </p>
          </form>
        )}

        {loggedIn && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "1rem",
              }}
            >
              <StatCard label="Users" value={users.length.toString()} />
              <StatCard label="Households" value={totalHouseholds.toString()} />
              <StatCard label="Status" value={dataLoading ? "Refreshing..." : "Live"} />
            </section>

            {statusMessage && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "rgba(34,211,238,0.1)",
                  border: "1px solid rgba(34,211,238,0.3)",
                  color: "#67e8f9",
                }}
              >
                {statusMessage}
              </div>
            )}

            {dataError && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "rgba(248,113,113,0.12)",
                  border: "1px solid rgba(248,113,113,0.4)",
                  color: "#fca5a5",
                }}
              >
                {dataError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => token && fetchUsers(token)}
                disabled={dataLoading}
                style={{
                  backgroundColor: "#22d3ee",
                  color: "#0f172a",
                  border: "none",
                  borderRadius: "999px",
                  padding: "0.5rem 1.25rem",
                  cursor: dataLoading ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                {dataLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#94a3b8", fontSize: "0.85rem", letterSpacing: "0.05em" }}>
                    <th style={{ padding: "0.75rem" }}>Name</th>
                    <th style={{ padding: "0.75rem" }}>Email</th>
                    <th style={{ padding: "0.75rem" }}>Households</th>
                    <th style={{ padding: "0.75rem" }}>Created</th>
                    <th style={{ padding: "0.75rem" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && !dataLoading && (
                    <tr>
                      <td colSpan={5} style={{ padding: "1.5rem", textAlign: "center", color: "#94a3b8" }}>
                        No users found.
                      </td>
                    </tr>
                  )}
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      style={{
                        borderTop: "1px solid rgba(148,163,184,0.15)",
                      }}
                    >
                      <td style={{ padding: "0.75rem", fontWeight: 500 }}>{user.name || "Unnamed"}</td>
                      <td style={{ padding: "0.75rem", color: "#cbd5f5" }}>{user.email}</td>
                      <td style={{ padding: "0.75rem" }}>
                        {user.households.length === 0 ? (
                          <span style={{ color: "#94a3b8" }}>No household</span>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                            {user.households.map((household) => (
                              <span
                                key={household.id}
                                style={{
                                  padding: "0.2rem 0.6rem",
                                  borderRadius: "999px",
                                  border: "1px solid rgba(148,163,184,0.4)",
                                  fontSize: "0.8rem",
                                }}
                              >
                                {household.name ?? "Unnamed"} <span style={{ color: "#94a3b8" }}>({household.role})</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem", color: "#94a3b8", fontSize: "0.9rem" }}>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <button
                          onClick={() => handleResetPassword(user)}
                          disabled={resettingUserId === user.id}
                          style={{
                            backgroundColor: "#1d4ed8",
                            color: "#e2e8f0",
                            border: "none",
                            borderRadius: "0.5rem",
                            padding: "0.4rem 0.75rem",
                            cursor: resettingUserId === user.id ? "not-allowed" : "pointer",
                            fontSize: "0.85rem",
                          }}
                        >
                          {resettingUserId === user.id ? "Resetting..." : "Reset password"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(148,163,184,0.2)",
        borderRadius: "0.75rem",
        padding: "1rem",
        background: "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(8,47,73,0.7))",
      }}
    >
      <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>{label}</div>
      <div style={{ fontSize: "1.75rem", fontWeight: 600 }}>{value}</div>
    </div>
  );
}
