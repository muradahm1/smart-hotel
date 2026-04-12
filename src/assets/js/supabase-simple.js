

// Configuration
const SUPABASE_URL = 'https://ozhvejzazlvsxojeoxcj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96aHZlanphemx2c3hvamVveGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzOTkzOTEsImV4cCI6MjA3ODk3NTM5MX0.fXoNjZGYK40OFuEZKGUeNFGVjCJPU9T2acKLhcC8CEg';

// Initialize Supabase client
let supabaseInstance = null;

function initSupabase() {
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        try {
            supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            window.supabaseClient = supabaseInstance;
            return true;
        } catch (error) {
            return false;
        }
    } else {
        return false;
    }
}

// Try to initialize when script loads
if (!initSupabase()) {
    // Wait for Supabase library to load
    let attempts = 0;
    const maxAttempts = 50;
    
    const checkSupabase = setInterval(() => {
        attempts++;
        if (initSupabase() || attempts >= maxAttempts) {
            clearInterval(checkSupabase);
            if (attempts >= maxAttempts) {
                console.error('❌ Failed to initialize Supabase after maximum attempts');
            }
        }
    }, 100);
}

console.log('Supabase configuration loaded');