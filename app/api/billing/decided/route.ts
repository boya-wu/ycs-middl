import { getDecidedBillingDecisions } from '@/actions/billing/queries';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * API Route: 取得已認領時數紀錄（認領看板「認領後」分頁用）
 */
export async function GET() {
  const result = await getDecidedBillingDecisions();

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store, must-revalidate' },
      }
    );
  }

  return NextResponse.json(
    { success: true, data: result.data },
    {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    }
  );
}
