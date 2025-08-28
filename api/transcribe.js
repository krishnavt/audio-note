// Audio transcription and structuring API endpoint
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
        const { audioData, sessionToken } = req.body;

        if (!audioData) {
            return res.status(400).json({ error: 'Audio data is required' });
        }

        // For demo purposes, simulate transcription
        // In production, you would use services like OpenAI Whisper, Google Speech-to-Text, etc.
        const mockTranscript = generateMockTranscript();
        
        // Structure the transcript into email-like format
        const structuredOutput = await structureTranscript(mockTranscript);

        // If user has session token, they get enhanced features
        if (sessionToken) {
            const user = await getUserBySession(sessionToken);
            if (user) {
                // Enhanced processing for signed-in users
                return res.status(200).json({
                    transcript: mockTranscript,
                    structured: structuredOutput,
                    enhanced: true,
                    remainingMinutes: user.remainingMinutes
                });
            }
        }

        // Basic processing for non-signed-in users
        return res.status(200).json({
            transcript: mockTranscript,
            structured: structuredOutput,
            enhanced: false,
            message: 'Sign up for enhanced AI processing and unlimited recording!'
        });

    } catch (error) {
        console.error('Transcription error:', error);
        return res.status(500).json({ error: 'Failed to process audio: ' + error.message });
    }
}

function generateMockTranscript() {
    // Mock transcripts for demo - in production this would come from actual speech recognition
    const mockTranscripts = [
        "Hello, I wanted to follow up on our meeting yesterday about the new project proposal. I think we should schedule another call to discuss the timeline and budget requirements.",
        "This is a reminder about the upcoming conference next week. Please make sure to register and book your hotel accommodations as soon as possible.",
        "I've been thinking about our conversation regarding the marketing strategy. I have some new ideas that could help increase our reach and engagement.",
        "Quick note about today's presentation - it went really well and the client seemed very interested in our proposal. I'll send over the follow-up materials tomorrow.",
        "Just wanted to record some thoughts about the team meeting. We need to prioritize the user experience improvements and focus on the mobile interface."
    ];
    
    return mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
}

async function structureTranscript(transcript) {
    // Simple text structuring - in production you'd use AI to create better structure
    const sentences = transcript.split('. ');
    
    if (sentences.length <= 2) {
        return transcript;
    }
    
    // Create simple paragraph structure
    const structured = sentences.map((sentence, index) => {
        if (index === 0) {
            return `**Main Point:** ${sentence.trim()}.`;
        } else if (index === sentences.length - 1) {
            return `**Next Steps:** ${sentence.trim()}`;
        } else {
            return `• ${sentence.trim()}.`;
        }
    }).join('\n\n');
    
    return structured;
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