import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const event = req.body;

  // Verify event payload structure
  if (event?.data?.attributes?.type === 'checkout_session.payment.paid') {
    const session = event.data.attributes.data;
    const orderId = session.attributes.reference_number;

    // Update DB Order Status
    const { error } = await supabase
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', orderId);

    if (error) {
      return res.status(500).json({ error: 'Database update failed' });
    }
  }

  return res.status(200).json({ received: true });
}
