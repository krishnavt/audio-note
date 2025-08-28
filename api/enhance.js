// Vercel serverless function for AI text enhancement
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
        const { text, mode, sessionToken } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Text is required' });
        }

        if (!sessionToken) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Verify session and get user
        const user = await getUserBySession(sessionToken);
        if (!user) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        // Check user's remaining time (each enhancement costs 1 minute)
        if (user.remainingMinutes < 1) {
            return res.status(402).json({ 
                error: 'Insufficient time. Please purchase more conversion time.',
                remainingMinutes: 0
            });
        }

        // Call OpenAI API
        const enhancedText = await callOpenAI(text, mode);
        
        if (enhancedText) {
            // Deduct 1 minute of conversion time
            await deductTime(user.email, 1, mode);
            const remainingMinutes = await getUserRemainingMinutes(user.email);
            
            return res.status(200).json({
                enhancedText,
                remainingMinutes,
                usage: {
                    originalLength: text.length,
                    enhancedLength: enhancedText.length,
                    mode: mode,
                    timeUsed: 1
                }
            });
        } else {
            return res.status(500).json({ error: 'Failed to enhance text' });
        }

    } catch (error) {
        console.error('Enhancement error:', error);
        return res.status(500).json({ 
            error: error.message || 'Internal server error' 
        });
    }
}

async function callOpenAI(text, mode) {
    const prompts = {
        fix: `Fix the grammar, spelling, and punctuation in the following text while preserving the original meaning and tone. Make it clear and readable:\n\n${text}`,
        rewrite: `Rewrite and restructure the following text to make it clear, professional, and well-organized. Improve flow and readability while preserving all key information:\n\n${text}`,
        summarize: `Summarize the following text into key points, keeping the most important information concise and clear:\n\n${text}`,
        formal: `Rewrite the following text in a formal, professional tone suitable for business or academic contexts:\n\n${text}`,
        bullets: `Convert the following text into a well-organized bullet point format, grouping related ideas together:\n\n${text}`
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'user',
                    content: prompts[mode] || prompts.fix
                }
            ],
            max_tokens: 2000,
            temperature: 0.3
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content?.trim();
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

async function deductTime(email, minutes, mode) {
    const user = users.get(email);
    if (!user) return;
    
    user.remainingMinutes = Math.max(0, user.remainingMinutes - minutes);
    user.totalMinutesUsed = (user.totalMinutesUsed || 0) + minutes;
    
    if (!user.usage) user.usage = [];
    user.usage.push({
        timestamp: new Date().toISOString(),
        mode,
        timeUsed: minutes,
        type: 'enhancement'
    });

    users.set(email, user);
    return minutes;
}