import { eq } from "drizzle-orm";
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth-options";
import db from "@/db";

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const runningStrategies = await db.select().from(payment).where(eq(payment.userId, session.user.id), eq(payment.status, 'in-process'));

    const formattedStrategies = runningStrategies.map((payment: PaymentWithStrategy) => ({
      id: payment.id,
      strategyName: payment.strategy.name,
      status: payment.status,
    }));

    return NextResponse.json(formattedStrategies);
  } catch (error) {
    console.error('Error fetching running strategies:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

interface PaymentWithStrategy {
  id: string;
  strategy: {
    name: string;
  };
  status: string;
}