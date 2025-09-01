// Supabase client configuration
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
}

export const supabase = supabaseUrl && supabaseKey 
    ? createClient(supabaseUrl, supabaseKey)
    : null;

// Database schema functions
export async function createUserProfile(email) {
    if (!supabase) {
        console.log('Supabase not configured, using fallback user creation');
        return {
            email,
            id: `temp_${Date.now()}`,
            subscription_type: 'free',
            remaining_minutes: 1.0,
            total_transcripts: 0,
            created_at: new Date().toISOString()
        };
    }
    
    try {
        const { data, error } = await supabase
            .from('users')
            .insert([
                { 
                    email,
                    created_at: new Date().toISOString(),
                    subscription_type: 'free',
                    remaining_minutes: 1.0,
                    total_transcripts: 0
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error creating user profile in Supabase:', error);
            // Fallback to temporary user if database creation fails
            return {
                email,
                id: `temp_${Date.now()}`,
                subscription_type: 'free',
                remaining_minutes: 1.0,
                total_transcripts: 0,
                created_at: new Date().toISOString()
            };
        }
        
        return data;
    } catch (err) {
        console.error('Supabase connection error:', err);
        // Fallback to temporary user
        return {
            email,
            id: `temp_${Date.now()}`,
            subscription_type: 'free',
            remaining_minutes: 1.0,
            total_transcripts: 0,
            created_at: new Date().toISOString()
        };
    }
}

export async function getUserProfile(email) {
    if (!supabase) return null;
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }
        
        return data;
    } catch (err) {
        console.error('Supabase getUserProfile error:', err);
        return null;
    }
}

export async function updateUserMinutes(email, remainingMinutes) {
    if (!supabase) return false;
    
    const { error } = await supabase
        .from('users')
        .update({ remaining_minutes: remainingMinutes })
        .eq('email', email);

    if (error) {
        console.error('Error updating user minutes:', error);
        return false;
    }
    
    return true;
}

export async function saveTranscript(email, originalText, enhancedText, audioUrl = null) {
    if (!supabase) return null;
    
    const { data, error } = await supabase
        .from('transcripts')
        .insert([
            {
                user_email: email,
                original_text: originalText,
                enhanced_text: enhancedText,
                audio_url: audioUrl,
                created_at: new Date().toISOString(),
                word_count: enhancedText.split(/\s+/).length
            }
        ])
        .select()
        .single();

    if (error) {
        console.error('Error saving transcript:', error);
        return null;
    }
    
    // Update user's total transcript count
    await supabase
        .from('users')
        .update({ 
            total_transcripts: supabase.raw('total_transcripts + 1')
        })
        .eq('email', email);
    
    return data;
}

export async function getUserTranscripts(email, limit = 50) {
    if (!supabase) return [];
    
    const { data, error } = await supabase
        .from('transcripts')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching transcripts:', error);
        return [];
    }
    
    return data || [];
}

// Subscription management
export async function updateUserSubscription(email, subscriptionType, remainingMinutes) {
    if (!supabase) return false;
    
    const { error } = await supabase
        .from('users')
        .update({ 
            subscription_type: subscriptionType,
            remaining_minutes: remainingMinutes,
            subscription_updated_at: new Date().toISOString()
        })
        .eq('email', email);

    if (error) {
        console.error('Error updating subscription:', error);
        return false;
    }
    
    return true;
}

// Billing history functions
export async function addBillingRecord(email, amount, description, minutesPurchased, stripeSessionId = null) {
    if (!supabase) return false;
    
    try {
        const { error } = await supabase
            .from('billing_history')
            .insert([{
                user_email: email,
                amount,
                description,
                minutes_purchased: minutesPurchased,
                stripe_session_id: stripeSessionId,
                status: 'completed',
                created_at: new Date().toISOString()
            }]);

        if (error) {
            console.error('Error adding billing record:', error);
            return false;
        }
        
        return true;
    } catch (err) {
        console.error('Billing record error:', err);
        return false;
    }
}

export async function getBillingHistory(email, limit = 20) {
    if (!supabase) return [];
    
    try {
        const { data, error } = await supabase
            .from('billing_history')
            .select('*')
            .eq('user_email', email)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching billing history:', error);
            return [];
        }
        
        return data || [];
    } catch (err) {
        console.error('Billing history fetch error:', err);
        return [];
    }
}