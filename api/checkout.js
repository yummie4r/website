module.exports = async (req, res) => {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cart } = req.body || {};

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: 'Cart is empty or invalid' });
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ error: 'PAYMONGO_SECRET_KEY is missing in Vercel settings.' });
    }

    const lineItems = cart.map((item) => ({
      name: item.title || 'Product',
      amount: Math.round((item.price || 0) * 100),
      currency: 'PHP',
      quantity: 1,
    }));

    const authHeader = `Basic ${Buffer.from(`${secretKey.trim()}:`).toString('base64')}`;

    const paymongoRes = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            payment_method_types: ['gcash', 'paymaya', 'card'],
            line_items: lineItems,
            success_url: `https://${req.headers.host}/?status=success`,
            cancel_url: `https://${req.headers.host}/?status=cancelled`,
          },
        },
      }),
    });

    const data = await paymongoRes.json();

    if (!paymongoRes.ok) {
      return res.status(400).json({
        error: data.errors?.[0]?.detail || 'PayMongo API error'
      });
    }

    return res.status(200).json({ checkoutUrl: data.data.attributes.checkout_url });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};
