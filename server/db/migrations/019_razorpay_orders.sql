-- Create razorpay_orders table to persist order state for secure payment verification
CREATE TABLE razorpay_orders (
    order_id TEXT PRIMARY KEY,
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'created',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE razorpay_orders ENABLE ROW LEVEL SECURITY;

-- Policy for razorpay_orders
CREATE POLICY "razorpay_orders_isolation_policy" ON razorpay_orders
    FOR ALL
    USING (circle_id = (SELECT circle_id FROM users WHERE id = auth.uid()));
