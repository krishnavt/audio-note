-- Supabase database setup for AudioNote
-- Run these commands in your Supabase SQL editor

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    subscription_type VARCHAR(50) DEFAULT 'free',
    remaining_minutes DECIMAL(10,2) DEFAULT 1.0,
    total_transcripts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    subscription_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transcripts table
CREATE TABLE IF NOT EXISTS transcripts (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
    original_text TEXT,
    enhanced_text TEXT,
    audio_url TEXT,
    word_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Billing history table
CREATE TABLE IF NOT EXISTS billing_history (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    stripe_session_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'completed',
    minutes_purchased INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_transcripts_user_email ON transcripts(user_email);
CREATE INDEX IF NOT EXISTS idx_transcripts_created_at ON transcripts(created_at);
CREATE INDEX IF NOT EXISTS idx_billing_user_email ON billing_history(user_email);
CREATE INDEX IF NOT EXISTS idx_billing_created_at ON billing_history(created_at);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view own transcripts" ON transcripts;
DROP POLICY IF EXISTS "Users can insert own transcripts" ON transcripts;
DROP POLICY IF EXISTS "Users can delete own transcripts" ON transcripts;
DROP POLICY IF EXISTS "Users can view own billing history" ON billing_history;
DROP POLICY IF EXISTS "Service can insert billing records" ON billing_history;
DROP POLICY IF EXISTS "Service role full access users" ON users;
DROP POLICY IF EXISTS "Service role full access transcripts" ON transcripts;
DROP POLICY IF EXISTS "Service role full access billing" ON billing_history;

-- Create policies for users table
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.jwt() ->> 'email' = email);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.jwt() ->> 'email' = email);

-- Create policies for transcripts table  
CREATE POLICY "Users can view own transcripts" ON transcripts FOR SELECT USING (auth.jwt() ->> 'email' = user_email);
CREATE POLICY "Users can insert own transcripts" ON transcripts FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = user_email);
CREATE POLICY "Users can delete own transcripts" ON transcripts FOR DELETE USING (auth.jwt() ->> 'email' = user_email);

-- Create policies for billing_history table
CREATE POLICY "Users can view own billing history" ON billing_history FOR SELECT USING (auth.jwt() ->> 'email' = user_email);
CREATE POLICY "Service can insert billing records" ON billing_history FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- For service role access (our API), we need to allow all operations
CREATE POLICY "Service role full access users" ON users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access transcripts" ON transcripts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access billing" ON billing_history FOR ALL USING (auth.role() = 'service_role');