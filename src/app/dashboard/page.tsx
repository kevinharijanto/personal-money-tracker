// src/app/dashboard/page.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Dashboard from "@/components/Dashboard";
import { useThemePreference } from "@/hooks/useThemePreference";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { palette } = useThemePreference();

  useEffect(() => {
    if (status === "loading") return; // Still loading
    if (!session) {
      router.push("/auth"); // Not authenticated, redirect to auth page
    }
  }, [session, status, router]);

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (!session) {
    return null; // Will redirect
  }

  const greeting = session.user?.name || session.user?.email;

  return (
    <div
      style={{
        background: palette.background,
        minHeight: "100vh",
      }}
    >
      <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            color: palette.text,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "14px", color: palette.subtle }}>
              Signed in as
            </span>
            <strong style={{ fontSize: "18px" }}>{greeting}</strong>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/auth" })}
            style={{
              padding: "10px 18px",
              backgroundColor: "#f87171",
              color: "#fff",
              border: "none",
              borderRadius: "999px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Sign Out
          </button>
        </div>

        <Dashboard />
      </div>
    </div>
  );
}
