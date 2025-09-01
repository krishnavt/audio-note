// Simple test API to check environment variables and imports
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Check environment variables
        const hasSupabaseUrl = !!process.env.SUPABASE_URL;
        const hasSupabaseKey = !!process.env.SUPABASE_ANON_KEY;
        const supabaseUrl = process.env.SUPABASE_URL;
        
        // Try importing supabase
        let supabaseStatus = 'not imported';
        try {
            const { supabase } = await import('./supabase.js');
            supabaseStatus = supabase ? 'connected' : 'null client';
        } catch (importError) {
            supabaseStatus = `import error: ${importError.message}`;
        }

        return res.status(200).json({
            success: true,
            environment: {
                hasSupabaseUrl,
                hasSupabaseKey,
                supabaseUrlPreview: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'missing',
                nodeVersion: process.version,
                timestamp: new Date().toISOString()
            },
            supabaseStatus,
            message: 'Test API working'
        });

    } catch (error) {
        return res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
}