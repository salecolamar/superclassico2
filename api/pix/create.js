// Cria uma cobrança PIX real via API de Orders do Mercado Pago.
// Chamado pelo front-end (PixModal) quando um jogador vai pagar a mensalidade.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { playerId, monthKey, amount, description } = req.body || {};
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

  try {
    const mpRes = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${playerId}-${monthKey}-${Date.now()}`,
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
        description: (description || 'Mensalidade Super Clássico').slice(0, 250),
      }),
    });

    const json = await mpRes.json();
    if (!mpRes.ok) {
      console.error('MP create order failed', mpRes.status, json);
      res.status(502).json({ error: 'Falha ao gerar cobrança PIX no Mercado Pago.' });
      return;
    }

    const paymentMethod = json?.transactions?.payments?.[0]?.payment_method;
    if (!paymentMethod?.qr_code) {
      console.error('MP order without qr_code', json);
      res.status(502).json({ error: 'PIX gerado sem QR Code.' });
      return;
    }

    res.status(200).json({
      orderId: json.id,
      qrCode: paymentMethod.qr_code,
      qrCodeBase64: paymentMethod.qr_code_base64,
    });
  } catch (err) {
    console.error('pix/create error', err);
    res.status(500).json({ error: 'Erro ao gerar PIX.' });
  }
}
