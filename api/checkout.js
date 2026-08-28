export default async function handler(req, res) {
  // Allow requests from frontend
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cart } = req.body;

    if (!cart || cart.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Format line items for PayMongo
    const lineItems = cart.map((item) => ({
      name: item.title || 'Product',
      amount: Math.round((item.price || 0) * 100), // amount in centavos
      currency: 'PHP',
      quantity: 1,
    }));

    // Call PayMongo API securely from server-side
    const paymongoResponse = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64'),
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            payment_method_types: ['gcash', 'paymaya', 'card'],
            line_items: lineItems,
            success_url: req.headers.origin + '/?status=success',
            cancel_url: req.headers.origin + '/?status=cancelled',
          },
        },
      }),
    });

    const data = await paymongoResponse.json();

    if (!paymongoResponse.ok) {
      return res.status(paymongoResponse.status).json({ 
        error: data.errors?.[0]?.detail || 'Failed to create PayMongo checkout session' 
      });
    }

    return res.status(200).json({ checkoutUrl: data.data.attributes.checkout_url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
