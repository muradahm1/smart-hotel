// Public configuration - SECURITY WARNING: Never expose real credentials here
// This file is publicly accessible - use environment variables in production

// Check for environment variables (Bundlers/Node)
if (typeof process !== 'undefined' && process.env) {
    if (process.env.SUPABASE_URL) window.SUPABASE_URL = process.env.SUPABASE_URL;
    if (process.env.SUPABASE_ANON_KEY) window.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
}

// SECURITY: Check if credentials are already loaded from secure config
if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    // Fallback for demo purposes only - REPLACE WITH ENVIRONMENT VARIABLES
    console.warn('⚠️ Using fallback credentials - NOT SECURE FOR PRODUCTION');
    
    // Demo credentials - MUST BE REPLACED
    window.SUPABASE_URL = 'https://ozhvejzazlvsxojeoxcj.supabase.co';
    window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96aHZlanphemx2c3hvamVveGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzOTkzOTEsImV4cCI6MjA3ODk3NTM5MX0.fXoNjZGYK40OFuEZKGUeNFGVjCJPU9T2acKLhcC8CEg';
    
    if (window.SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE') {
        console.error('❌ Supabase credentials not configured! Please set up your environment variables.');
        // Show user-friendly error
        if (typeof document !== 'undefined') {
            document.addEventListener('DOMContentLoaded', () => {
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:#ff4444;color:white;padding:10px;text-align:center;z-index:9999;';
                errorDiv.textContent = 'Configuration Error: Supabase credentials not set up. Please contact administrator.';
                document.body.insertBefore(errorDiv, document.body.firstChild);
            });
        }
    }
}

// Validate configuration
if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && 
    window.SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE') {
    console.log('🔧 Supabase configuration validated ✅');
} else {
    console.error('❌ Invalid Supabase configuration');
}