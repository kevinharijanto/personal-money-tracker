import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hashWithPepper, compareWithPepper } from '@/lib/security';

// Setup PIN for quick login
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pin, type = 'PIN' } = await request.json();
    
    if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 });
    }

    const userId = (session.user as any).id;
    
    // Hash the PIN
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

    return NextResponse.json({ success: true, message: 'PIN setup successfully' });
  } catch (error) {
    console.error('Error setting up PIN:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Verify PIN for quick login
export async function PUT(request: NextRequest) {
  try {
    const { email, pin } = await request.json();
    
    if (!email || !pin) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
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
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    
    // Verify PIN
    const isValid = await compareWithPepper(pin, quickLogin.pinHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    // Return user info for session creation
    return NextResponse.json({
      success: true,
      user: {
        id: quickLogin.user.id,
        email: quickLogin.user.email,
        name: quickLogin.user.name,
      },
    });
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get quick login status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    
    const quickLogins = await prisma.quickLogin.findMany({
      where: { userId },
      select: {
        type: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ quickLogins });
  } catch (error) {
    console.error('Error getting quick login status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Disable quick login
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type = 'PIN' } = await request.json();
    const userId = (session.user as any).id;

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

    return NextResponse.json({ success: true, message: 'Quick login disabled' });
  } catch (error) {
    console.error('Error disabling quick login:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}