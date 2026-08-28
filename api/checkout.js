export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { cart } = req.body || {};

  if (!cart || cart.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: 'PAYMONGO_SECRET_KEY is missing in Vercel settings.' });
  }

  // Format line items for PayMongo (amount in centavos: PHP * 100)
  const lineItems = cart.map((item) => ({
    name: item.title,
    amount: Math.round(item.price * 100),
    currency: 'PHP',
    quantity: 1,
  }));

  const authHeader = `Basic ${Buffer.from(`${secretKey.trim()}:`).toString('base64')}`;

  try {
    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
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

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({ 
        error: data.errors?.[0]?.detail || 'Failed to generate PayMongo session.' 
      });
    }

    // Returns the official PayMongo checkout redirect link
    return res.status(200).json({ checkoutUrl: data.data.attributes.checkout_url });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error connecting to PayMongo.' });
  }
}
