import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hashWithPepper, compareWithPepper } from '@/lib/security';
import { withAuth } from '@/lib/hybrid-auth';
import { addCorsHeaders } from '@/lib/cors';

// Handle preflight
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const res = new NextResponse(null, { status: 200 });
  return addCorsHeaders(res, origin);
}

// Setup PIN for quick login
export const POST = withAuth(async (request: Request, userId: string) => {
  const { pin, type = 'PIN' } = await request.json();
  
  if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
    const res = NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 });
    return addCorsHeaders(res, request.headers.get('origin'));
  }
  
  // Hash PIN
  const pinHash = await hashWithPepper(pin);

  // Create or update quick login
  const quickLogin = await prisma.quickLogin.upsert({
    where: {
      userId_type: {
        userId,
        type: type as any,
      },
    },
    update: {
      pinHash,
      enabled: true,
      updatedAt: new Date(),
    },
    create: {
      userId,
      type: type as any,
      pinHash,
      enabled: true,
    },
  });

  const res = NextResponse.json({ success: true, message: 'PIN setup successfully' });
  return addCorsHeaders(res, request.headers.get('origin'));
});

// Verify PIN for quick login
export async function PUT(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  try {
    const { email, pin } = await request.json();
    
    if (!email || !pin) {
      const res = NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      return addCorsHeaders(res, origin);
    }

    // Find quick login record
    const quickLogin = await prisma.quickLogin.findFirst({
      where: {
        user: { email },
        type: 'PIN',
        enabled: true,
        pinHash: { not: null } // Ensure PIN is set
      },
      include: { user: true },
    });

    // Always return same error to prevent user enumeration
    if (!quickLogin || !quickLogin.user || !quickLogin.pinHash) {
      // Run dummy comparison to prevent timing attacks
      await compareWithPepper('dummy', '$2a$10$dummydummydummydummydum');
      const res = NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      return addCorsHeaders(res, origin);
    }
    
    // Verify PIN
    const isValid = await compareWithPepper(pin, quickLogin.pinHash);
    if (!isValid) {
      const res = NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
      return addCorsHeaders(res, origin);
    }

    // Return user info for session creation
    const res = NextResponse.json({
      success: true,
      user: {
        id: quickLogin.user.id,
        email: quickLogin.user.email,
        name: quickLogin.user.name,
      },
    });
    return addCorsHeaders(res, origin);
  } catch (error) {
    console.error('Error verifying PIN:', error);
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    return addCorsHeaders(res, origin);
  }
}

// Get quick login status
export const GET = withAuth(async (request: Request, userId: string) => {
  const quickLogins = await prisma.quickLogin.findMany({
    where: { userId },
    select: {
      type: true,
      enabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const res = NextResponse.json({ quickLogins });
  return addCorsHeaders(res, request.headers.get('origin'));
});

// Disable quick login
export const DELETE = withAuth(async (request: Request, userId: string) => {
  const { type = 'PIN' } = await request.json();

  await prisma.quickLogin.updateMany({
    where: {
      userId,
      type: type as any,
    },
    data: {
      enabled: false,
      updatedAt: new Date(),
    },
  });

  const res = NextResponse.json({ success: true, message: 'Quick login disabled' });
  return addCorsHeaders(res, request.headers.get('origin'));
});