import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret   = process.env.PLAID_SECRET;
  const env      = process.env.PLAID_ENV ?? 'sandbox';

  if (!clientId || !secret) {
    return NextResponse.json(
      { error: 'Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to .env.local.' },
      { status: 500 }
    );
  }

  const baseUrl = env === 'production'
    ? 'https://production.plaid.com'
    : env === 'development'
      ? 'https://development.plaid.com'
      : 'https://sandbox.plaid.com';

  const res = await fetch(`${baseUrl}/link/token/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      secret,
      client_name: 'Dedomena',
      country_codes: ['US', 'GB', 'CA', 'FR', 'DE'],
      language: 'en',
      user: { client_user_id: 'dedomena-user' },
      products: ['transactions', 'auth'],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: data.error_message ?? 'Failed to create link token' }, { status: 500 });
  }

  return NextResponse.json({ linkToken: data.link_token });
}
