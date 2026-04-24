// Connects The Github Project And Supabase Projects Together
const SUPABASE_URL = "https://esgqyiiwjnuaoqdcksxs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZ3F5aWl3am51YW9xZGNrc3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTM5MjMsImV4cCI6MjA5MDQ2OTkyM30.qVXXrPtm6s8VgVdliGByjKmZsAliBf6soQ1zj74B-hA";

console.log("Global supabase object:", typeof supabase, supabase);
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
console.log("Created supabaseClient:", typeof supabaseClient);

// Make it available globally for script.js
window.supabaseClient = supabaseClient;
