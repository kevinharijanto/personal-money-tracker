"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useThemePreference } from "@/hooks/useThemePreference";

export default function AuthPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { theme, palette, toggleTheme } = useThemePreference();

  useEffect(() => {
    if (status === "authenticated" && session) {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password. Please try again.");
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in right now. Please try again later.",
      );
    } finally {
      setLoading(false);
    }
  };

  const formDisabled = loading || status === "loading";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: palette.background,
        color: palette.text,
        transition: "background 0.3s ease, color 0.3s ease",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          borderRadius: "24px",
          padding: "32px",
          background: palette.card,
          color: palette.text,
          boxShadow:
            theme === "dark"
              ? "0 20px 35px rgba(0,0,0,0.6)"
              : "0 25px 50px -12px rgba(15,23,42,0.25)",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "8px",
          }}
        >
          <div>
            <p style={{ margin: 0, color: palette.subtle, fontWeight: 600 }}>
              Personal Money Tracker
            </p>
            <h1 style={{ margin: "6px 0 4px" }}>Sign in to the web console</h1>
            <p style={{ margin: 0, color: palette.muted }}>
              Login only. Account creation lives in the Flutter mobile app.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              borderRadius: "999px",
              border: `1px solid ${palette.gridBorder}`,
              background: palette.card,
              color: palette.text,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            {theme === "dark" ? "Light" : "Dark"}
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

        <form
          onSubmit={handleSignIn}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                border: `1px solid ${palette.gridBorder}`,
                background: palette.inputBg,
                color: palette.text,
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            Password
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              placeholder="********"
              style={{
                padding: "12px 42px 12px 14px",
                borderRadius: "12px",
                border: `1px solid ${palette.gridBorder}`,
                background: palette.inputBg,
                color: palette.text,
              }}
            />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={palette.subtle}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={formDisabled}
            style={{
              marginTop: "8px",
              padding: "14px",
              borderRadius: "16px",
              border: "none",
              backgroundColor: formDisabled ? palette.buttonMuted : palette.button,
              color: palette.buttonText,
              fontWeight: 600,
              cursor: formDisabled ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "14px",
            color: palette.subtle,
          }}
        >
          <span>Forgot your password?</span>
          <Link
            href="/auth/forgot"
            style={{
              color: palette.button,
              textDecoration: "underline",
            }}
          >
            Reset it
          </Link>
        </div>

        <p style={{ margin: "4px 0 0", color: palette.subtle, fontSize: "14px" }}>
          Need an account? Use the Flutter mobile app to onboard and invite your
          household.
        </p>
      </div>
    </div>
  );
}
