// Cria uma cobrança PIX real via API de Orders do Mercado Pago.
// Chamado pelo front-end (PixModal) quando um jogador vai pagar a mensalidade.

const SANDBOX_TEST_EMAIL = process.env.MP_TEST_PAYER_EMAIL || 'test_user_3630145896@testuser.com';

async function createOrder(accessToken, { amountStr, playerId, monthKey, description, payerEmail }) {
  const mpRes = await fetch('https://api.mercadopago.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `${playerId}-${monthKey}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
    body: JSON.stringify({
      type: 'online',
      total_amount: amountStr,
      external_reference: `${playerId}_${monthKey}`,
      processing_mode: 'automatic',
      transactions: {
        payments: [
          {
            amount: amountStr,
            payment_method: { id: 'pix', type: 'bank_transfer' },
          },
        ],
      },
      payer: { email: payerEmail },
      description: (description || 'Mensalidade Super Clássico').slice(0, 250),
    }),
  });
  const json = await mpRes.json();
  return { ok: mpRes.ok, status: mpRes.status, json };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { playerId, monthKey, amount, description, email } = req.body || {};
  if (!playerId || !monthKey || !amount || Number(amount) <= 0) {
    res.status(400).json({ error: 'Dados incompletos para gerar o PIX.' });
    return;
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    res.status(500).json({ error: 'Pagamento PIX não configurado no servidor.' });
    return;
  }

  const amountStr = Number(amount).toFixed(2);
  const realEmail = email || `jogador-${playerId}@superclassico.app`;

  try {
    let result = await createOrder(accessToken, { amountStr, playerId, monthKey, description, payerEmail: realEmail });

    // Conta ainda em modo sandbox: o Mercado Pago recusa e-mail "real" e pede
    // um e-mail de conta de teste. Tenta de novo automaticamente com ele.
    const needsSandboxEmail = !result.ok && (result.json?.errors || []).some((e) => e.code === 'invalid_email_for_sandbox');
    if (needsSandboxEmail) {
      result = await createOrder(accessToken, { amountStr, playerId, monthKey, description, payerEmail: SANDBOX_TEST_EMAIL });
    }

    if (!result.ok) {
      console.error('MP create order failed', result.status, result.json);
      res.status(502).json({ error: 'Falha ao gerar cobrança PIX no Mercado Pago.' });
      return;
    }

    const paymentMethod = result.json?.transactions?.payments?.[0]?.payment_method;
    if (!paymentMethod?.qr_code) {
      console.error('MP order without qr_code', result.json);
      res.status(502).json({ error: 'PIX gerado sem QR Code.' });
      return;
    }

    res.status(200).json({
      orderId: result.json.id,
      qrCode: paymentMethod.qr_code,
      qrCodeBase64: paymentMethod.qr_code_base64,
    });
  } catch (err) {
    console.error('pix/create error', err);
    res.status(500).json({ error: 'Erro ao gerar PIX.' });
  }
}
