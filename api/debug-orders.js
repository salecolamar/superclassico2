// TEMPORÁRIO — lista os pedidos recentes pra diagnosticar por que o webhook não confirmou. Apagar depois.
export default async function handler(req, res) {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  const now = new Date();
  const begin = new Date(now.getTime() - 3 * 60 * 60 * 1000); // últimas 3h
  const params = new URLSearchParams({
    begin_date: begin.toISOString(),
    end_date: now.toISOString(),
    sort_by: 'created_date',
    sort_order: 'desc',
    page_size: '20',
  });
  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/orders?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await mpRes.json();
    res.status(200).json({ status: mpRes.status, json });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
