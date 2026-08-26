// Recebe as notificações do Mercado Pago quando uma cobrança PIX muda de status.
// Valida a assinatura (x-signature), confirma o pagamento direto na API do Mercado
// Pago (nunca confia só no corpo da notificação) e marca a mensalidade como paga.
import crypto from 'node:crypto';
import { db, auth } from '../../src/firebase.js';
import { doc, updateDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

function isValidSignature(dataId, xRequestId, xSignature, secret) {
  if (!dataId || !xSignature || !secret) return false;
  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => {
      const [k, v] = p.split('=');
      return [k?.trim(), v?.trim()];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${String(dataId).toLowerCase()};request-id:${xRequestId || ''};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  const expBuf = Buffer.from(expected, 'hex');
  const sigBuf = Buffer.from(v1, 'hex');
  return expBuf.length === sigBuf.length && crypto.timingSafeEqual(expBuf, sigBuf);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).end();
    return;
  }

  try {
    const dataId = req.query['data.id'] || req.query.id || req.body?.data?.id;
    const xRequestId = req.headers['x-request-id'];
    const xSignature = req.headers['x-signature'];
    const secret = process.env.MP_WEBHOOK_SECRET;

    if (!isValidSignature(dataId, xRequestId, xSignature, secret)) {
      console.warn('Assinatura de webhook inválida ou ausente');
      res.status(200).end();
      return;
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    const orderRes = await fetch(`https://api.mercadopago.com/v1/orders/${dataId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const order = await orderRes.json();
    if (!orderRes.ok) {
      console.error('Falha ao buscar order no Mercado Pago', orderRes.status, order);
      res.status(200).end();
      return;
    }

    const payments = order?.transactions?.payments || [];
    const approvedPayment = payments.find((p) => p.status === 'processed' && p.status_detail === 'accredited');
    if (!approvedPayment) {
      res.status(200).end();
      return;
    }

    const [playerId, monthKey] = String(order.external_reference || '').split('_');
    if (!playerId || !monthKey) {
      console.error('external_reference inválido', order.external_reference);
      res.status(200).end();
      return;
    }

    await signInAnonymously(auth);
    const ref = doc(db, 'furao-fc', 'furao-app-data');
    await updateDoc(ref, {
      [`payments.${playerId}.${monthKey}`]: {
        paid: true,
        amount: Number(approvedPayment.amount) || 0,
        paidAt: new Date().toISOString(),
        claimed: true,
        claimedAt: new Date().toISOString(),
        source: 'mercadopago',
        mpOrderId: order.id,
      },
    });

    res.status(200).end();
  } catch (err) {
    console.error('pix/webhook error', err);
    res.status(200).end();
  }
}
