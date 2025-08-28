// Real Stripe checkout session creation
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sessionToken, minutes, amount } = req.body;

        if (!sessionToken || !minutes || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify user session
        const user = await getUserBySession(sessionToken);
        if (!user) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        // For demo purposes without real Stripe keys, simulate checkout
        if (!process.env.STRIPE_SECRET_KEY) {
            const mockCheckoutSession = {
                id: `cs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                url: `${req.headers.origin || 'https://audionote.app'}/?demo_payment=true&minutes=${minutes}&amount=${amount}`,
                success_url: `${req.headers.origin || 'https://audionote.app'}/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${req.headers.origin || 'https://audionote.app'}/`,
                amount_total: amount * 100,
                currency: 'usd'
            };

            return res.status(200).json({
                sessionId: mockCheckoutSession.id,
                url: mockCheckoutSession.url,
                demo: true
            });
        }

        // Real Stripe integration (uncomment when you have Stripe keys)
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `AudioNote Conversion Time (${minutes} minutes)`,
                        description: `${minutes} minutes of AI-powered voice-to-text conversion`,
                        images: ['https://audionote.app/icon.png']
                    },
                    unit_amount: amount * 100 // Amount in cents
                },
                quantity: 1
            }],
            mode: 'payment',
            success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin}/`,
            customer_email: user.email,
            metadata: {
                userEmail: user.email,
                userId: user.userId,
                minutes: minutes.toString(),
                type: 'time_purchase'
            }
        });

        return res.status(200).json({
            sessionId: session.id,
            url: session.url
        });

    } catch (error) {
        console.error('Checkout error:', error);
        return res.status(500).json({ error: error.message });
    }
}

// In-memory storage for demo - in production use a proper database
const users = new Map();

async function getUserBySession(sessionToken) {
    // Find user by session token
    for (const [email, user] of users.entries()) {
        if (user.sessionToken === sessionToken && user.sessionExpiresAt > new Date()) {
            return user;
        }
    }
    return null;
}