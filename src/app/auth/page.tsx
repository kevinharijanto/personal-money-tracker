"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Form states for sign in
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  // Form states for sign up
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [householdName, setHouseholdName] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email: signInEmail,
        password: signInPassword,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      setError("An error occurred during sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: signUpEmail,
          password: signUpPassword,
          name: signUpName,
          householdName: householdName,
        }),
      });

      if (response.ok) {
        // After successful registration, sign in the user
        const result = await signIn("credentials", {
          email: signUpEmail,
          password: signUpPassword,
          redirect: false,
        });

        if (result?.error) {
          setError("Account created but failed to sign in");
        } else {
          router.push("/dashboard");
        }
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create account");
      }
    } catch (error) {
      setError("An error occurred during sign up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      maxWidth: "400px", 
      margin: "50px auto", 
      padding: "20px",
      border: "1px solid #ddd",
      borderRadius: "8px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
    }}>
      <h1 style={{ textAlign: "center", marginBottom: "20px" }}>
        {isSignUp ? "Sign Up" : "Sign In"}
      </h1>

      {error && (
        <div style={{ 
          color: "red", 
          marginBottom: "15px", 
          padding: "10px",
          backgroundColor: "#ffebee",
          borderRadius: "4px",
          textAlign: "center"
        }}>
          {error}
        </div>
      )}

      {!isSignUp ? (
        // Sign In Form
        <form onSubmit={handleSignIn}>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Email</label>
            <input
              type="email"
              value={signInEmail}
              onChange={(e) => setSignInEmail(e.target.value)}
              required
              style={{ 
                width: "100%", 
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px"
              }}
            />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Password</label>
            <input
              type="password"
              value={signInPassword}
              onChange={(e) => setSignInPassword(e.target.value)}
              required
              style={{ 
                width: "100%", 
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px"
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>
      ) : (
        // Sign Up Form
        <form onSubmit={handleSignUp}>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Name</label>
            <input
              type="text"
              value={signUpName}
              onChange={(e) => setSignUpName(e.target.value)}
              style={{ 
                width: "100%", 
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px"
              }}
            />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Email</label>
            <input
              type="email"
              value={signUpEmail}
              onChange={(e) => setSignUpEmail(e.target.value)}
              required
              style={{ 
                width: "100%", 
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px"
              }}
            />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Password</label>
            <input
              type="password"
              value={signUpPassword}
              onChange={(e) => setSignUpPassword(e.target.value)}
              required
              minLength={8}
              style={{ 
                width: "100%", 
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px"
              }}
            />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Household Name</label>
            <input
              type="text"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              required
              placeholder="e.g., My Family"
              style={{ 
                width: "100%", 
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px"
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>
      )}

      <div style={{ textAlign: "center", marginTop: "20px" }}>
        {isSignUp ? "Already have an account?" : "Don't have an account?"}
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError("");
          }}
          style={{
            background: "none",
            border: "none",
            color: "#2196F3",
            textDecoration: "underline",
            cursor: "pointer",
            marginLeft: "5px"
          }}
        >
          {isSignUp ? "Sign In" : "Sign Up"}
        </button>
      </div>
    </div>
  );
}