// Vercel serverless function for credit management
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
        // Get user credits
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        try {
            const credits = await getUserCredits(userId);
            const usage = await getUserUsage(userId);
            
            return res.status(200).json({
                credits,
                usage
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    if (req.method === 'POST') {
        // Add credits (after payment)
        const { userId, amount, paymentId } = req.body;
        
        if (!userId || !amount || !paymentId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        try {
            // In production, verify payment with Stripe here
            await addCredits(userId, amount, paymentId);
            const newBalance = await getUserCredits(userId);
            
            return res.status(200).json({
                success: true,
                credits: newBalance,
                added: amount
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function getUserCredits(userId) {
    // Simple in-memory storage for demo - in production use a database
    const users = JSON.parse(process.env.USER_DATA || '{}');
    return users[userId]?.credits || 5; // Give new users 5 free credits
}

async function getUserUsage(userId) {
    const users = JSON.parse(process.env.USER_DATA || '{}');
    return users[userId]?.usage || [];
}

async function addCredits(userId, amount, paymentId) {
    const users = JSON.parse(process.env.USER_DATA || '{}');
    
    if (!users[userId]) {
        users[userId] = { credits: 5, usage: [], payments: [] };
    }
    
    users[userId].credits += amount;
    users[userId].payments.push({
        timestamp: new Date().toISOString(),
        amount,
        paymentId
    });

    // In production, save to database
    process.env.USER_DATA = JSON.stringify(users);
}