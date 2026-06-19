const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const authenticate = require('../middleware/authenticate');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Initialize Razorpay client
// Using test credentials if env variables are missing for development
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_YourTestKeyHere',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'YourTestSecretHere',
});

// Endpoint to create a Razorpay order
router.post('/create-order', authenticate, async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt = 'receipt#1' } = req.body;
    
    const options = {
      amount: amount * 100, // amount in the smallest currency unit (paise)
      currency,
      receipt,
      payment_capture: 1 // Auto capture
    };

    const order = await razorpay.orders.create(options);
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

    const secret = process.env.RAZORPAY_KEY_SECRET || 'YourTestSecretHere';

    // Verify signature
    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
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
