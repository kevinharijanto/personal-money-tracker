// src/app/page.tsx
"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return; // Still loading
    if (session) {
      router.push("/dashboard"); // Authenticated, redirect to dashboard
    } else {
      router.push("/auth"); // Not authenticated, redirect to auth
    }
  }, [session, status, router]);

  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      height: "100vh" 
    }}>
      <div>Loading...</div>
    </div>
  );
}
