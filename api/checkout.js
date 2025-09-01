// Stripe checkout API for AudioNote
import Stripe from 'stripe';
import { getUserProfile, updateUserMinutes, addBillingRecord } from './supabase.js';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

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
        const { action, sessionToken, minutes, amount, email, sessionId } = req.body;

        // Handle different actions
        if (action === 'success') {
            return await handlePaymentSuccess(req, res, email, sessionId, minutes, amount);
        }

        // Default checkout creation
        if (!email || !minutes || !amount) {
            return res.status(400).json({ error: 'Email, minutes, and amount are required' });
        }

        // Get user profile from Supabase
        let user = null;
        if (sessionToken) {
            // Verify user session (implementation needed)
            user = await getUserProfile(email);
        }

        // If Stripe is not configured, return demo mode
        if (!stripe) {
            console.log('Stripe not configured, returning demo checkout');
            return res.status(200).json({
                success: true,
                demo: true,
                message: 'Demo mode - Stripe not configured',
                checkoutUrl: '/demo-checkout',
                minutes,
                amount
            });
        }
        
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

async function handlePaymentSuccess(req, res, email, sessionId, minutes, amount) {
    try {
        // For demo mode
        if (!stripe) {
            // Simulate successful payment and add minutes
            await updateUserMinutes(email, minutes);
            
            // Add billing record
            await addBillingRecord(
                email, 
                amount, 
                `${minutes} minutes purchase (Demo)`, 
                minutes, 
                `demo_${Date.now()}`
            );

            return res.status(200).json({
                success: true,
                demo: true,
                message: `Successfully added ${minutes} minutes!`,
                minutesAdded: minutes
            });
        }

        // For real Stripe integration
        if (sessionId) {
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            
            if (session.payment_status === 'paid') {
                // Add minutes to user account
                await updateUserMinutes(email, minutes);
                
                // Record billing history
                await addBillingRecord(
                    email,
                    amount,
                    `${minutes} minutes purchase`,
                    minutes,
                    sessionId
                );

                return res.status(200).json({
                    success: true,
                    message: `Successfully added ${minutes} minutes!`,
                    minutesAdded: minutes
                });
            }
        }

        return res.status(400).json({ error: 'Payment not completed' });
    } catch (error) {
        console.error('Payment success handling error:', error);
        return res.status(500).json({ error: 'Failed to process payment success' });
    }
}