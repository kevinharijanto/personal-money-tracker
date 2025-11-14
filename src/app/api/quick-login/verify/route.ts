import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Verify quick login for NextAuth integration
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has any enabled quick login methods
    const quickLogins = await prisma.quickLogin.findMany({
      where: {
        userId: user.id,
        enabled: true,
      },
    });

    if (quickLogins.length === 0) {
      return NextResponse.json({ error: 'No quick login methods enabled' }, { status: 400 });
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
    console.error('Error verifying quick login:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}