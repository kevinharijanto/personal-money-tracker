/**
 * NextAuth configuration (Credentials-only, JWT sessions).
 * This uses your existing Prisma User model with an added passwordHash field and avoids
 * the Prisma Adapter tables to prevent conflicts with your domain Account model.
 *
 * Usage in route handler: see [route.ts](src/app/api/auth/[...nextauth]/route.ts)
 */
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * Validate user credentials against Prisma User (email + passwordHash).
 * Returns a minimal user object for NextAuth session.
 */
async function authorizeWithPrisma(email: string, password: string) {
  // Check if this is a quick login attempt
  if (password === "quick-login") {
    // For quick login, we need to verify through the quick login API
    try {
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/quick-login/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (!data.success) {
        return null;
      }

      // Return the user from quick login verification
      return {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name ?? null,
      };
    } catch (error) {
      console.error("Quick login verification failed:", error);
      return null;
    }
  }

  // Regular password authentication
  const user = (await prisma.user.findUnique({ where: { email } })) as any;
  if (!user || !user.passwordHash) {
    return null;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return null;
  }

  // Minimal user shape for NextAuth
  const result = {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
  };
  
  return result;
}

/**
 * NextAuth Options (JWT + Email Strategy)
 * - providers: Email (magic links) + Credentials (email + password)
 * - session: JWT
 * - callbacks: attach user.id into token, expose it in session.user.id
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString().trim() ?? "";
        const password = credentials?.password?.toString() ?? "";
        if (!email || !password) return null;
        return await authorizeWithPrisma(email, password);
      },
    }),
    // You can add OAuth providers later (e.g., Google) without schema conflicts:
    // GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })
  ],
  secret: process.env.NEXTAUTH_SECRET,
  // Use the correct URL for NextAuth callbacks
  useSecureCookies: process.env.NODE_ENV === "production",
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // Configure the callback URLs to use the correct port
  callbacks: {
    async jwt({ token, user, account }) {
      // On login, persist user id into the token
      if (user?.id) {
        token.uid = user.id;
        token.email = user.email;
        token.name = user.name;
        
      }
      
      // Handle account provider info
      if (account) {
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose user id in session for server-side access if needed
      if (session.user && token.uid) {
        (session.user as any).id = token.uid;
        session.user.email = token.email;
        session.user.name = token.name;
        
      }
      return session;
    },
    async signIn({ user, account, profile, email, credentials }) {
      return true;
    },
    async redirect({ url, baseUrl }) {
      // Use the request baseUrl to avoid cross-origin/port mismatches
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/dashboard`;
    },
  },
  // Custom auth pages
  pages: {
    signIn: "/signin",
  },
};