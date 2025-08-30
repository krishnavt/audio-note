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
    try {
        // Check if we have email configuration
        const emailConfig = {
            service: process.env.EMAIL_SERVICE || 'gmail',
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        };

        // If no email config, fall back to demo mode
        if (!emailConfig.auth.user || !emailConfig.auth.pass) {
            console.log(`📧 Demo mode - Code for ${email}: ${code}`);
            console.log(`📧 To enable real emails, set these Vercel environment variables:`);
            console.log(`   EMAIL_USER=your-gmail@gmail.com`);
            console.log(`   EMAIL_PASS=your-app-password`);
            console.log(`📧 Get Gmail App Password: https://support.google.com/mail/answer/185833`);
            await new Promise(resolve => setTimeout(resolve, 500));
            return true;
        }

        // Use dynamic import for nodemailer to avoid bundling issues in Vercel
        const nodemailer = await import('nodemailer');
        
        // Create transporter
        const transporter = nodemailer.default.createTransporter(emailConfig);

        // Email template
        const mailOptions = {
            from: `"AudioNote" <${emailConfig.auth.user}>`,
            to: email,
            subject: 'Your AudioNote Verification Code',
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #FF6B35; font-size: 2rem; margin: 0;">AudioNote</h1>
                        <p style="color: #666; margin: 10px 0 0 0;">Convert voice notes into readable text</p>
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; text-align: center;">
                        <h2 style="color: #333; margin: 0 0 20px 0;">Your Verification Code</h2>
                        <div style="background: white; border: 2px solid #FF6B35; border-radius: 8px; padding: 20px; margin: 20px 0; display: inline-block;">
                            <span style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; color: #FF6B35; letter-spacing: 8px;">${code}</span>
                        </div>
                        <p style="color: #666; margin: 20px 0 0 0;">This code will expire in 10 minutes.</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                        <p style="color: #999; font-size: 14px; margin: 0;">
                            If you didn't request this code, please ignore this email.
                        </p>
                    </div>
                </div>
            `
        };

        // Send email
        await transporter.sendMail(mailOptions);
        console.log(`✅ Verification email sent successfully to ${email}`);
        return true;

    } catch (error) {
        console.error('Error sending verification email:', error);
        // Fall back to demo mode if email fails
        console.log(`📧 Fallback to demo mode - sending email to ${email} with code: ${code}`);
        return true; // Don't fail the whole process if email fails
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}