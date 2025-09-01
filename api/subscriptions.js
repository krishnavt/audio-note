// Subscription management API
import { SUBSCRIPTION_PLANS, getPlanPricing } from './subscription-plans.js';
import { supabase, updateUserSubscription, getUserProfile, getBillingHistory } from './supabase.js';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { action } = req.body || {};

    try {
        switch (action) {
            case 'get-plans':
                return await handleGetPlans(req, res);
            case 'create-checkout':
                return await handleCreateCheckout(req, res);
            case 'handle-webhook':
                return await handleStripeWebhook(req, res);
            case 'get-usage':
                return await handleGetUsage(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Subscription error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handleGetPlans(req, res) {
    const pricing = getPlanPricing();
    
    return res.status(200).json({
        success: true,
        plans: pricing,
        openaiCosts: pricing.map(p => ({
            plan: p.id,
            openaiCost: p.openaiCost,
            margin: p.margin,
            marginPercent: p.marginPercent
        }))
    });
}

async function handleCreateCheckout(req, res) {
    const { sessionToken, planId, email } = req.body;
    
    if (!planId || !email) {
        return res.status(400).json({ error: 'Plan and email required' });
    }

    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) {
        return res.status(400).json({ error: 'Invalid plan' });
    }

    if (!stripe.apiKey) {
        // Demo mode
        return res.status(200).json({
            success: true,
            demo: true,
            plan: plan,
            message: 'Demo mode - Stripe not configured'
        });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `AudioNote ${plan.name}`,
                        description: plan.features.join(', '),
                    },
                    unit_amount: Math.round(plan.price * 100),
                    recurring: plan.period ? {
                        interval: plan.period
                    } : undefined,
                },
                quantity: 1,
            }],
            mode: plan.period ? 'subscription' : 'payment',
            success_url: `${req.headers.origin || 'https://audionote.app'}?success=true&plan=${planId}`,
            cancel_url: `${req.headers.origin || 'https://audionote.app'}?canceled=true`,
            metadata: {
                email,
                planId,
                sessionToken
            }
        });

        return res.status(200).json({
            success: true,
            url: session.url
        });
    } catch (error) {
        console.error('Stripe checkout error:', error);
        return res.status(500).json({ error: 'Failed to create checkout session' });
    }
}

async function handleGetUsage(req, res) {
    const { sessionToken, email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email required' });
    }

    const user = await getUserProfile(email);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Get transcript history from Supabase
    const { data: transcripts, error } = supabase
        ? await supabase
            .from('transcripts')
            .select('created_at, word_count, original_text, enhanced_text')
            .eq('user_email', email)
            .order('created_at', { ascending: false })
            .limit(10)
        : { data: [], error: null };

    // Get billing history
    const billingHistory = await getBillingHistory(email, 10);

    return res.status(200).json({
        success: true,
        user: {
            email: user.email,
            subscriptionType: user.subscription_type,
            remainingMinutes: user.remaining_minutes,
            totalTranscripts: user.total_transcripts,
            createdAt: user.created_at
        },
        recentTranscripts: transcripts || [],
        billingHistory: billingHistory.map(item => ({
            date: item.created_at,
            amount: item.amount,
            description: item.description,
            status: item.status
        })),
        usage: {
            thisMonth: user.remaining_minutes,
            totalAllTime: user.total_transcripts
        }
    });
}