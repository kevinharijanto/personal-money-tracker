"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { useThemePreference } from "@/hooks/useThemePreference";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { palette } = useThemePreference();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirm) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to reset password");
      }
      setStatus("success");
      setMessage("Password updated. Redirecting to sign in...");
      setTimeout(() => router.push("/auth"), 1500);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Failed to reset password",
      );
    }
  };

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
            "0 25px 50px -12px rgba(15,23,42,0.25), 0 0 0 1px rgba(148,163,184,0.15)",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Set a new password</h1>
          <p style={{ margin: "6px 0 0", color: palette.muted }}>
            Choose a new password for your account.
          </p>
        </div>

        {status !== "idle" && message && (
          <div
            style={{
              padding: "12px",
              borderRadius: "12px",
              border: `1px solid ${
                status === "success" ? "#16a34a" : palette.warningBorder
              }`,
              background:
                status === "success" ? "rgba(22,163,74,0.15)" : palette.warningBg,
              color: status === "success" ? "#14532d" : palette.danger,
            }}
          >
            {message}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            New Password
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
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

          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            Confirm Password
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
              minLength={8}
              placeholder="********"
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                border: `1px solid ${palette.gridBorder}`,
                background: palette.inputBg,
                color: palette.text,
              }}
            />
          </label>

          <button
            type="submit"
            disabled={status === "loading"}
            style={{
              marginTop: "8px",
              padding: "14px",
              borderRadius: "16px",
              border: "none",
              backgroundColor:
                status === "loading" ? palette.buttonMuted : palette.button,
              color: palette.buttonText,
              fontWeight: 600,
              cursor: status === "loading" ? "not-allowed" : "pointer",
            }}
          >
            {status === "loading" ? "Saving..." : "Update Password"}
          </button>
        </form>

        <a
          href="/auth"
          style={{ color: palette.button, textDecoration: "underline" }}
        >
          Back to sign in
        </a>
      </div>
    </div>
  );
}
