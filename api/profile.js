// Profile data API
import { getUserProfile, getBillingHistory, getUserTranscripts } from './supabase.js';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, sessionToken } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Get user profile
        let user = await getUserProfile(email);
        if (!user) {
            console.log('User not found in database, creating fallback user for:', email);
            // Create a fallback user for testing
            user = {
                email: email,
                id: `temp_${Date.now()}`,
                subscription_type: 'free',
                remaining_minutes: 1.0,
                total_transcripts: 0,
                created_at: new Date().toISOString()
            };
        }

        // Get billing history
        const billingHistory = await getBillingHistory(email, 20);

        // Get transcript history
        const transcripts = await getUserTranscripts(email, 20);

        return res.status(200).json({
            success: true,
            user: {
                email: user.email,
                id: user.id,
                subscriptionType: user.subscription_type,
                remainingMinutes: user.remaining_minutes,
                totalTranscripts: user.total_transcripts,
                createdAt: user.created_at
            },
            billingHistory: billingHistory.map(item => ({
                date: item.created_at,
                amount: item.amount,
                description: item.description,
                status: item.status
            })),
            recentTranscripts: transcripts || []
        });

    } catch (error) {
        console.error('Profile API error:', error);
        return res.status(500).json({ 
            error: error.message || 'Internal server error' 
        });
    }
}