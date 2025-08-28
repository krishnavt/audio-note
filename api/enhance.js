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
        const { text, mode, userId } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Text is required' });
        }

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        // Check user's remaining credits
        const userCredits = await getUserCredits(userId);
        if (userCredits <= 0) {
            return res.status(402).json({ 
                error: 'Insufficient credits. Please purchase more credits to continue.',
                credits: 0
            });
        }

        // Call OpenAI API
        const enhancedText = await callOpenAI(text, mode);
        
        if (enhancedText) {
            // Deduct credit and log usage
            await deductCredit(userId, text.length, mode);
            const remainingCredits = await getUserCredits(userId);
            
            return res.status(200).json({
                enhancedText,
                credits: remainingCredits,
                usage: {
                    originalLength: text.length,
                    enhancedLength: enhancedText.length,
                    mode: mode
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

async function getUserCredits(userId) {
    // Simple in-memory storage for demo - in production use a database
    const users = JSON.parse(process.env.USER_DATA || '{}');
    return users[userId]?.credits || 0;
}

async function deductCredit(userId, textLength, mode) {
    // Calculate cost based on text length and mode
    let cost = 1; // Base cost
    
    if (textLength > 500) cost = 2;
    if (textLength > 1000) cost = 3;
    if (mode === 'rewrite' || mode === 'formal') cost += 1;
    
    // Simple in-memory storage for demo - in production use a database
    const users = JSON.parse(process.env.USER_DATA || '{}');
    if (!users[userId]) {
        users[userId] = { credits: 0, usage: [] };
    }
    
    users[userId].credits = Math.max(0, (users[userId].credits || 0) - cost);
    users[userId].usage.push({
        timestamp: new Date().toISOString(),
        textLength,
        mode,
        cost
    });

    // In production, you'd save this to a database
    // For demo purposes, this won't persist between deployments
    process.env.USER_DATA = JSON.stringify(users);
    
    return cost;
}