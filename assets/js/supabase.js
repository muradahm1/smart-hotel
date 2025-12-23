// Supabase Configuration
if (typeof window.SUPABASE_URL_LOADED === 'undefined') {
    window.SUPABASE_URL_LOADED = window.SUPABASE_URL;
    window.SUPABASE_ANON_KEY_LOADED = window.SUPABASE_ANON_KEY;
}
const SUPABASE_URL = window.SUPABASE_URL_LOADED;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY_LOADED;

// Initialize Supabase client (prevent multiple initializations)
let supabaseClient;

// Wait for Supabase to load then initialize
function initSupabase() {
    if (window.supabaseClient) {
        return true;
    }
    
    if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.supabaseClient = supabaseClient; // Store globally to prevent re-initialization
        console.log('✅ Supabase client initialized successfully');
        return true;
    }
    return false;
}

// Try to initialize immediately
if (!initSupabase()) {
    // If not ready, wait for page load
    window.addEventListener('load', () => {
        setTimeout(initSupabase, 100);
    });
}

console.log('Supabase initialization script loaded');