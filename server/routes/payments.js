const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const authenticate = require('../middleware/authenticate');
const { assertCircleMember } = require('../middleware/authorizer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Initialize Razorpay client
const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

if (!key_id || !key_secret) {
  console.warn('Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET');
}

const razorpay = new Razorpay({ key_id: key_id || 'rzp_test_dummy', key_secret: key_secret || 'dummy_secret' });

// Endpoint to create a Razorpay order
router.post('/create-order', authenticate, async (req, res) => {
  try {
    const circle_id = req.user.circle_id;
    if (!circle_id) {
      return res.status(403).json({ success: false, error: 'No circle_id provided' });
    }
    try {
      assertCircleMember(req, circle_id);
    } catch (authErr) {
      return res.status(403).json({ success: false, error: 'Unauthorized access to this circle' });
    }

    // Fixed price for premium family plan as per GEMINI.md (CC-006)
    const expectedAmount = 149; 
    const currency = 'INR';

    const options = {
      amount: expectedAmount * 100, // amount in paise
      currency,
      receipt: `receipt_${circle_id}_${Date.now()}`.substring(0, 40),
      payment_capture: 1
    };

    const order = await razorpay.orders.create(options);

    // Persist order state in razorpay_orders table (CC-006)
    const { error: insertErr } = await supabase
      .from('razorpay_orders')
      .insert([{
        order_id: order.id,
        circle_id: circle_id,
        user_id: req.user.id,
        amount: expectedAmount,
        currency,
        status: 'created'
      }]);

    if (insertErr) {
      console.error('Failed to persist razorpay order:', insertErr);
      return res.status(500).json({ success: false, error: 'Failed to initialize payment order' });
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ success: false, error: 'Failed to create order' });
  }
});

// Endpoint to verify the payment signature
router.post('/verify', authenticate, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const circle_id = req.user.circle_id;
    
    if (!circle_id) {
      return res.status(403).json({ success: false, error: 'No circle_id provided' });
    }
    try {
      assertCircleMember(req, circle_id);
    } catch (authErr) {
      return res.status(403).json({ success: false, error: 'Unauthorized access to this circle' });
    }

    // Query razorpay_orders table to verify order binding and prevent reuse (CC-006)
    const { data: orderRecord, error: orderErr } = await supabase
      .from('razorpay_orders')
      .select('*')
      .eq('order_id', razorpay_order_id)
      .single();

    if (orderErr || !orderRecord) {
      return res.status(404).json({ success: false, error: 'Payment order record not found' });
    }

    if (String(orderRecord.circle_id) !== String(circle_id)) {
      return res.status(403).json({ success: false, error: 'Payment order does not belong to this circle' });
    }

    if (orderRecord.status === 'verified') {
      return res.status(400).json({ success: false, error: 'Payment order has already been verified' });
    }

    const secret = key_secret;

    // Verify signature
    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // Verify payment status directly against Razorpay API before upgrading circle (CC-007)
      if (process.env.NODE_ENV === 'production') {
        try {
          const payment = await razorpay.payments.fetch(razorpay_payment_id);
          if (payment.status !== 'captured' && payment.status !== 'authorized') {
            return res.status(400).json({ success: false, error: `Payment check failed: status is ${payment.status}` });
          }
        } catch (fetchErr) {
          console.error('Razorpay payment fetch error:', fetchErr);
          return res.status(502).json({ success: false, error: 'Failed to verify payment status with Razorpay API' });
        }
      } else {
        try {
          const payment = await razorpay.payments.fetch(razorpay_payment_id);
          if (payment.status !== 'captured' && payment.status !== 'authorized') {
            return res.status(400).json({ success: false, error: `Payment check failed: status is ${payment.status}` });
          }
        } catch (mockErr) {
          console.log('Skipping strict Razorpay fetch in non-production environment due to dummy keys');
        }
      }

      // Mark order as verified
      await supabase
        .from('razorpay_orders')
        .update({ status: 'verified' })
        .eq('order_id', razorpay_order_id);

      // Payment is successful, upgrade circle to premium
      const { error } = await supabase
        .from('circles')
        .update({ is_premium: true })
        .eq('id', circle_id);
        
      if (error) {
        throw error;
      }

      res.status(200).json({ success: true, message: 'Payment verified and circle upgraded' });
    } else {
      res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, error: 'Payment verification failed' });
  }
});

module.exports = router;
