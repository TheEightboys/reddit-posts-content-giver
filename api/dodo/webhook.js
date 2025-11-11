// =====================================================
// FILE: api/dodo/webhook.js
// Lazy-loaded Supabase - won't crash if env vars missing
// =====================================================
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Don't initialize here - will initialize when webhook is called
let supabase = null;

function getSupabaseClient() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables not set');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

// Verify webhook signature
function verifySignature(payload, signature, secret) {
  try {
    if (!secret) {
      console.error('❌ DODO_WEBHOOK_SECRET is not set');
      return false;
    }
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');
    return digest === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Process webhook events
async function processWebhook(data) {
  const eventType = data.type;
  console.log('🔄 Processing event type:', eventType);

  if (eventType === 'checkout.session.completed' || eventType === 'payment.succeeded') {
    await handlePaymentSuccess(data);
  }
}

// Handle successful payment
async function handlePaymentSuccess(data) {
  try {
    const supabase = getSupabaseClient(); // Get client when needed
    const session = data.data;
    const metadata = session.metadata || {};
    
    console.log('💳 Session ID:', session.id);
    console.log('📧 Customer:', session.customer_email);
    console.log('📝 Metadata:', metadata);
    
    if (!metadata.userId) {
      console.error('❌ No userId in metadata');
      return;
    }

    const userId = metadata.userId;
    const planType = metadata.planType || 'starter';
    const billingCycle = metadata.billingCycle || 'monthly';
    const amount = (session.amount_total || 0) / 100;

    console.log('💰 Activating plan:', { userId, planType, amount });

    // Insert payment record
    const { error: paymentError } = await supabase
      .from('payment_records')
      .insert({
        payment_id: session.id,
        user_id: userId,
        plan_type: planType,
        amount: amount,
        billing_cycle: billingCycle,
        status: 'completed',
        verified_at: new Date().toISOString(),
      });

    if (paymentError) {
      console.error('❌ Payment record error:', paymentError);
      return;
    }

    console.log('✅ Payment record inserted');

    // Insert into payments table
    await supabase.from('payments').insert({
      user_id: userId,
      customer_email: session.customer_email || metadata.email,
      transaction_id: session.id,
      plan_type: planType,
      amount: amount,
      billing_cycle: billingCycle,
      status: 'completed',
      dodo_session_id: session.id,
      metadata: metadata,
      completed_at: new Date().toISOString(),
    });

    // Activate plan
    const planLimits = {
      starter: 150,
      professional: 250,
      enterprise: 300,
    };

    const credits = planLimits[planType] || 150;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + (billingCycle === 'yearly' ? 12 : 1));

    const { error: planError } = await supabase
      .from('user_plans')
      .upsert({
        user_id: userId,
        plan_type: planType,
        posts_per_month: credits,
        credits_remaining: credits,
        billing_cycle: billingCycle,
        status: 'active',
        amount: amount,
        activated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (planError) {
      console.error('❌ Plan activation error:', planError);
    } else {
      console.log('✅ Plan activated successfully for:', userId);
    }

  } catch (error) {
    console.error('❌ Payment handling error:', error);
  }
}

// Main webhook handler
async function handler(req, res) {
  console.log('📥 Webhook received from Dodo');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify signature
    const signature = req.headers['dodo-signature'] || req.headers['webhook-signature'];
    const payload = JSON.stringify(req.body);
    
    if (!verifySignature(payload, signature, process.env.DODO_WEBHOOK_SECRET)) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    console.log('✅ Signature verified');
    
    // Acknowledge immediately
    res.status(200).json({ received: true });

    // Process async
    processWebhook(req.body).catch(err => {
      console.error('❌ Webhook processing error:', err);
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(400).json({ error: 'Webhook failed' });
  }
}

// Export the handler
module.exports = handler;
