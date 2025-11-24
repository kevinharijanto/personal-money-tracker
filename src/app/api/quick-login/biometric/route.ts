import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/hybrid-auth';
import { addCorsHeaders } from '@/lib/cors';
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


// Handle preflight
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const res = new NextResponse(null, { status: 200 });
  return addCorsHeaders(res, origin);
}

// Setup biometric authentication
export const POST = withAuth(async (request: Request, userId: string) => {
  const { publicKey, credentialId } = await request.json();

  // For biometric authentication, we store public key and credential ID
  // In a real implementation, you would use WebAuthn or similar
  const quickLogin = await prisma.quickLogin.upsert({
    where: {
      userId_type: {
        userId,
        type: 'BIOMETRIC',
      },
    },
    update: {
      enabled: true,
      updatedAt: new Date(),
    },
    create: {
      userId,
      type: 'BIOMETRIC',
      enabled: true,
    },
  });

  const res = NextResponse.json({ 
    success: true, 
    message: 'Biometric authentication enabled',
    credentialId 
  });
  return addCorsHeaders(res, request.headers.get('origin'));
});

// Verify biometric authentication
export async function PUT(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  try {
    const { email, assertion } = await request.json();
    
    if (!email || !assertion) {
      const res = NextResponse.json({ error: 'Email and assertion are required' }, { status: 400 });
      return addCorsHeaders(res, origin);
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      const res = NextResponse.json({ error: 'User not found' }, { status: 404 });
      return addCorsHeaders(res, origin);
    }

    // Find quick login for this user
    const quickLogin = await prisma.quickLogin.findFirst({
      where: {
        userId: user.id,
        type: 'BIOMETRIC',
        enabled: true,
      },
    });

    if (!quickLogin) {
      const res = NextResponse.json({ error: 'Biometric authentication not set up for this user' }, { status: 400 });
      return addCorsHeaders(res, origin);
    }

    // In a real implementation, you would verify WebAuthn assertion here
    // For now, we'll simulate successful verification
    // TODO: Implement actual WebAuthn verification
    const isValid = true; // This would be replaced with actual WebAuthn verification

    if (!isValid) {
      const res = NextResponse.json({ error: 'Biometric verification failed' }, { status: 401 });
      return addCorsHeaders(res, origin);
    }

    // Return user info for session creation
    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
    return addCorsHeaders(res, origin);
  } catch (error) {
    console.error('Error verifying biometric authentication:', error);
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    return addCorsHeaders(res, origin);
  }
}
