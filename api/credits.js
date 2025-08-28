// Vercel serverless function for time management
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'GET') {
        // Get user time remaining
        const { sessionToken } = req.query;
        
        if (!sessionToken) {
            return res.status(401).json({ error: 'Session token is required' });
        }

        try {
            const user = await getUserBySession(sessionToken);
            if (!user) {
                return res.status(401).json({ error: 'Invalid or expired session' });
            }
            
            return res.status(200).json({
                remainingMinutes: user.remainingMinutes,
                totalMinutesUsed: user.totalMinutesUsed || 0,
                usage: user.usage || []
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    if (req.method === 'POST') {
        // Add time (after payment)
        const { sessionToken, minutes, paymentId } = req.body;
        
        if (!sessionToken || !minutes || !paymentId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        try {
            const user = await getUserBySession(sessionToken);
            if (!user) {
                return res.status(401).json({ error: 'Invalid or expired session' });
            }

            // In production, verify payment with Stripe here
            await addMinutes(user.email, minutes, paymentId);
            const newBalance = await getUserRemainingMinutes(user.email);
            
            return res.status(200).json({
                success: true,
                remainingMinutes: newBalance,
                added: minutes
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
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

async function getUserRemainingMinutes(email) {
    const user = users.get(email);
    return user?.remainingMinutes || 0;
}

async function addMinutes(email, minutes, paymentId) {
    const user = users.get(email);
    if (!user) return;
    
    user.remainingMinutes += minutes;
    
    if (!user.payments) user.payments = [];
    user.payments.push({
        timestamp: new Date().toISOString(),
        minutes,
        paymentId,
        type: 'purchase'
    });

    users.set(email, user);
}