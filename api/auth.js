// Authentication API with email verification
import crypto from 'crypto';

// In-memory storage for demo - in production use a proper database
const users = new Map();
const verificationCodes = new Map();

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { action, email, code } = req.body;

    try {
        switch (action) {
            case 'send-code':
                return await handleSendCode(req, res, email);
            case 'verify-code':
                return await handleVerifyCode(req, res, email, code);
            case 'check-session':
                return await handleCheckSession(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handleSendCode(req, res, email) {
    if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: 'Valid email is required' });
    }

    // Generate 6-digit verification code
    const code = Math.random().toString().substr(2, 6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store verification code
    verificationCodes.set(email, {
        code,
        expiresAt,
        attempts: 0
    });

    // Send email (using a service like SendGrid, Mailgun, or SES)
    const emailSent = await sendVerificationEmail(email, code);
    
    if (!emailSent) {
        return res.status(500).json({ error: 'Failed to send verification email' });
    }

    console.log(`Verification code for ${email}: ${code}`); // For demo purposes

    return res.status(200).json({ 
        success: true, 
        message: 'Verification code sent',
        // For demo purposes - in production never return the code
        demoCode: code
    });
}

async function handleVerifyCode(req, res, email, code) {
    if (!email || !code) {
        return res.status(400).json({ error: 'Email and code are required' });
    }

    const storedData = verificationCodes.get(email);
    
    if (!storedData) {
        return res.status(400).json({ error: 'No verification code found for this email' });
    }

    if (storedData.expiresAt < new Date()) {
        verificationCodes.delete(email);
        return res.status(400).json({ error: 'Verification code has expired' });
    }

    if (storedData.attempts >= 3) {
        verificationCodes.delete(email);
        return res.status(400).json({ error: 'Too many failed attempts' });
    }

    if (storedData.code !== code.trim()) {
        storedData.attempts++;
        return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Code is valid - create or update user
    let user = users.get(email);
    const isNewUser = !user;
    
    if (!user) {
        user = {
            email,
            userId: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            remainingMinutes: 1, // 1 minute free for new users
            totalMinutesUsed: 0,
            subscriptionStatus: 'free',
            lastLogin: new Date().toISOString()
        };
    } else {
        user.lastLogin = new Date().toISOString();
    }
    
    users.set(email, user);
    verificationCodes.delete(email);

    // Create session token
    const sessionToken = crypto.randomUUID();
    user.sessionToken = sessionToken;
    user.sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    return res.status(200).json({
        success: true,
        user: {
            email: user.email,
            userId: user.userId,
            remainingMinutes: user.remainingMinutes,
            sessionToken: user.sessionToken,
            isNewUser
        }
    });
}

async function handleCheckSession(req, res) {
    const { sessionToken } = req.body;
    
    if (!sessionToken) {
        return res.status(401).json({ error: 'No session token provided' });
    }

    // Find user by session token
    let userWithSession = null;
    for (const [email, user] of users.entries()) {
        if (user.sessionToken === sessionToken && user.sessionExpiresAt > new Date()) {
            userWithSession = user;
            break;
        }
    }

    if (!userWithSession) {
        return res.status(401).json({ error: 'Invalid or expired session' });
    }

    return res.status(200).json({
        success: true,
        user: {
            email: userWithSession.email,
            userId: userWithSession.userId,
            remainingMinutes: userWithSession.remainingMinutes
        }
    });
}

async function sendVerificationEmail(email, code) {
    // In production, integrate with email service like:
    // - SendGrid
    // - Mailgun  
    // - Amazon SES
    // - Nodemailer with SMTP
    
    // For demo, we'll simulate email sending
    console.log(`📧 Sending email to ${email} with code: ${code}`);
    
    // Simulate email service delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // For demo purposes, always return true
    // In production, handle email service errors
    return true;
    
    // Example with SendGrid:
    /*
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
        to: email,
        from: 'noreply@audionote.app',
        subject: 'AudioNote Verification Code',
        text: `Your verification code is: ${code}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #ff8c00;">AudioNote Verification</h2>
                <p>Your verification code is:</p>
                <div style="font-size: 24px; font-weight: bold; color: #ff8c00; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px;">${code}</div>
                <p>This code will expire in 10 minutes.</p>
            </div>
        `
    };

    try {
        await sgMail.send(msg);
        return true;
    } catch (error) {
        console.error('Email send error:', error);
        return false;
    }
    */
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}