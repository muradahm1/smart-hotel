// Supabase client initialization
let supabaseClient = null;

// Initialize Supabase client
function initSupabase() {
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        const SUPABASE_URL = window.SUPABASE_URL || 'https://ozhvejzazlvsxojeoxcj.supabase.co';
        const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96aHZlanphemx2c3hvamVveGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzOTkzOTEsImV4cCI6MjA3ODk3NTM5MX0.fXoNjZGYK40OFuEZKGUeNFGVjCJPU9T2acKLhcC8CEg';
        
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.supabaseClient = supabaseClient;
        return true;
    }
    return false;
}

// Try to initialize immediately
if (!initSupabase()) {
    // Wait for Supabase library to load
    const checkInterval = setInterval(() => {
        if (initSupabase()) {
            clearInterval(checkInterval);
        }
    }, 100);
    
    // Timeout after 10 seconds
    setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.supabaseClient) {
            console.error('❌ Failed to initialize Supabase client');
        }
    }, 10000);
}