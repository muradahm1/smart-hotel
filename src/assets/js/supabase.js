// Fast Supabase Configuration
const SUPABASE_URL = 'https://ozhvejzazlvsxojeoxcj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96aHZlanphemx2c3hvamVveGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzOTkzOTEsImV4cCI6MjA3ODk3NTM5MX0.fXoNjZGYK40OFuEZKGUeNFGVjCJPU9T2acKLhcC8CEg';

let supabaseInstance = null;

function initSupabase() {
    if (window.supabase && !supabaseInstance) {
        supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.supabaseClient = supabaseInstance;
        console.log('✅ Supabase ready');
        return true;
    }
    return false;
}

// Try immediate init
if (!initSupabase()) {
    // Wait for library
    const check = setInterval(() => {
        if (initSupabase()) clearInterval(check);
    }, 50);
}