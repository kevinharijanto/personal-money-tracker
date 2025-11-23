"use client";

import { SessionProvider } from "next-auth/react";
import { HouseholdProvider } from "@/contexts/HouseholdContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <HouseholdProvider>
        {children}
      </HouseholdProvider>
    </SessionProvider>
  );
}