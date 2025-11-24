"use client";

import { useState } from "react";
import { useThemePreference } from "@/hooks/useThemePreference";

export default function ForgotPasswordPage() {
  const { palette } = useThemePreference();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to send reset email");
      }
      setStatus("success");
      setMessage(data.message);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Failed to send reset email",
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
          <h1 style={{ margin: 0 }}>Forgot Password</h1>
          <p style={{ margin: "6px 0 0", color: palette.muted }}>
            Enter your email and we’ll send you a reset link.
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
            {status === "loading" ? "Sending..." : "Send Reset Link"}
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
