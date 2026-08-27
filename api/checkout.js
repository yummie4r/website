import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { productId, buyerId } = req.body;

  try {
    // 1. Fetch Product
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (prodErr || !product) throw new Error('Product not found');

    // 2. Create Pending Order in Supabase
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert([
        {
          buyer_id: buyerId,
          seller_id: product.seller_id,
          product_id: product.id,
          amount: product.price,
          status: 'pending'
        }
      ])
      .select()
      .single();

    if (orderErr) throw new Error('Failed to create order');

    // 3. Initiate PayMongo Checkout Session
    const paymongoOptions = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString('base64')}`
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            payment_method_types: ['gcash', 'card', 'paymaya'],
            line_items: [
              {
                currency: 'PHP',
                amount: Math.round(product.price * 100), // PayMongo expects centavos
                description: product.description,
                name: product.title,
                quantity: 1
              }
            ],
            reference_number: order.id,
            success_url: `${process.env.VERCEL_URL || 'http://localhost:3000'}/?status=success`,
            cancel_url: `${process.env.VERCEL_URL || 'http://localhost:3000'}/?status=cancelled`
          }
        }
      })
    };

    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', paymongoOptions);
    const sessionData = await response.json();

    if (sessionData.errors) {
      throw new Error(sessionData.errors[0].detail);
    }

    // 4. Update order with PayMongo Checkout Session ID
    await supabase
      .from('orders')
      .update({ paymongo_session_id: sessionData.data.id })
      .eq('id', order.id);

    return res.status(200).json({ checkoutUrl: sessionData.data.attributes.checkout_url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
