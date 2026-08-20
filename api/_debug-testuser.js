// TEMPORÁRIO — só pra gerar um usuário de teste do Mercado Pago e pegar o e-mail real. Apagar depois.
export default async function handler(req, res) {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  try {
    const mpRes = await fetch('https://api.mercadopago.com/users/test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ site_id: 'MLB', description: 'super classico test buyer' }),
    });
    const json = await mpRes.json();
    res.status(200).json({ status: mpRes.status, json });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
