import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { publicToken } = await req.json();

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret   = process.env.PLAID_SECRET;
  const env      = process.env.PLAID_ENV ?? 'sandbox';

  if (!clientId || !secret) {
    return NextResponse.json({ error: 'Plaid not configured' }, { status: 500 });
  }

  const baseUrl = env === 'production'
    ? 'https://production.plaid.com'
    : env === 'development'
      ? 'https://development.plaid.com'
      : 'https://sandbox.plaid.com';

  // Exchange public token for access token
  const exchRes = await fetch(`${baseUrl}/item/public_token/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, public_token: publicToken }),
  });
  const exchData = await exchRes.json();
  if (!exchRes.ok) {
    return NextResponse.json({ error: exchData.error_message ?? 'Token exchange failed' }, { status: 500 });
  }

  const accessToken = exchData.access_token;

  // Fetch accounts + recent transactions
  const [accRes, txRes] = await Promise.all([
    fetch(`${baseUrl}/accounts/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
    }),
    fetch(`${baseUrl}/transactions/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId, secret, access_token: accessToken,
        start_date: new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10),
        end_date:   new Date().toISOString().slice(0, 10),
        options:    { count: 500 },
      }),
    }),
  ]);

  const accData = await accRes.json();
  const txData  = await txRes.json();

  const accountLines = (accData.accounts ?? []).map((a: any) =>
    `Account: ${a.name} (${a.subtype}) | Balance: ${a.balances?.current} ${a.balances?.iso_currency_code}`
  );

  const txLines = (txData.transactions ?? []).map((t: any) =>
    `${t.date} | ${t.name} | ${t.amount} ${t.iso_currency_code} | ${t.category?.join(' > ') ?? ''}`
  );

  const content = [
    '=== ACCOUNTS ===',
    accountLines.join('\n'),
    '',
    '=== TRANSACTIONS (last 90 days) ===',
    txLines.join('\n'),
  ].join('\n');

  return NextResponse.json({ content });
}
