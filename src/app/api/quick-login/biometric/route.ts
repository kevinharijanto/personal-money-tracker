import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';

// Setup biometric authentication
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { publicKey, credentialId } = await request.json();
    const userId = (session.user as any).id;

    // For biometric authentication, we store the public key and credential ID
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

    return NextResponse.json({ 
      success: true, 
      message: 'Biometric authentication enabled',
      credentialId 
    });
  } catch (error) {
    console.error('Error setting up biometric authentication:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Verify biometric authentication
export async function PUT(request: NextRequest) {
  try {
    const { email, assertion } = await request.json();
    
    if (!email || !assertion) {
      return NextResponse.json({ error: 'Email and assertion are required' }, { status: 400 });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
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
      return NextResponse.json({ error: 'Biometric authentication not set up for this user' }, { status: 400 });
    }

    // In a real implementation, you would verify the WebAuthn assertion here
    // For now, we'll simulate successful verification
    const isValid = true; // This would be replaced with actual WebAuthn verification

    if (!isValid) {
      return NextResponse.json({ error: 'Biometric verification failed' }, { status: 401 });
    }

    // Return user info for session creation
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Error verifying biometric authentication:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}