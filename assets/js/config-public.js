// Public configuration - Use environment variables in production
// For development, set these in your local config.js file
window.SUPABASE_URL = window.SUPABASE_URL || 'https://ozhvejzazlvsxojeoxcj.supabase.co';
window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96aHZlanphemx2c3hvamVveGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzOTkzOTEsImV4cCI6MjA3ODk3NTM5MX0.fXoNjZGYK40OFuEZKGUeNFGVjCJPU9T2acKLhcC8CEg';

console.log('🔧 Supabase URL:', window.SUPABASE_URL);
console.log('🔧 Supabase Key: Loaded ✅');