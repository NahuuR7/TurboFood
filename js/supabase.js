const SUPABASE_URL = "https://shpmreyroukrkgdtfjzp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_wzHENzUbJX66hQs3LDt0bQ_7YX3qrWd";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

console.log("Turbo Food conectado con Supabase");