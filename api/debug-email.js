// TEMPORÁRIO — testa várias variações de e-mail de teste contra a API de Orders. Apagar depois.
export default async function handler(req, res) {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  const candidates = [
    'testuser3030692233937144155@testuser.com',
    'TESTUSER3030692233937144155@testuser.com',
    'test_user_3030692233937144155@testuser.com',
    'test_user_3630145896@testuser.com',
    'test@testuser.com',
  ];
  const results = [];
  for (const email of candidates) {
    try {
      const mpRes = await fetch('https://api.mercadopago.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `debug-${email}-${Date.now()}`,
        },
        body: JSON.stringify({
          type: 'online',
          total_amount: '1.00',
          external_reference: `debug_${Date.now()}`,
          processing_mode: 'automatic',
          transactions: { payments: [{ amount: '1.00', payment_method: { id: 'pix', type: 'bank_transfer' } }] },
          payer: { email },
          description: 'debug',
        }),
      });
      const json = await mpRes.json();
      results.push({ email, status: mpRes.status, ok: mpRes.ok, error: json.errors || json.message || null, hasQr: !!json?.transactions?.payments?.[0]?.payment_method?.qr_code });
    } catch (err) {
      results.push({ email, error: String(err) });
    }
  }
  res.status(200).json(results);
}
