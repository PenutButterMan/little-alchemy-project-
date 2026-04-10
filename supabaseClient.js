"""Connects The Githup Project And Supabase Projects Together"""
const SUPABASE_URL = "https://supabase.com/dashboard/project/esgqyiiwjnuaoqdcksxs";
const SUPABASE_KEY = "sb_publishable_ASL7y8N3KW6QKA7Z25m1rA_jmO-sYnr";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
