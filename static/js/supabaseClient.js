/**
 * Supabase client bootstrap.
 *
 * The Supabase JS SDK is loaded globally via a CDN <script> tag in
 * index.html, BEFORE this file — so `window.supabase` (the SDK) is
 * already available here. We wrap it into `supabaseClient`, which every
 * other script (engine.js, the inline Formula Manager script) will use.
 *
 * ── Local dev vs Production ─────────────────────────────────────────
 * The values below point at your LOCAL Supabase (`supabase start`).
 * When you deploy (Phase 8), swap these two constants for your hosted
 * project's Project URL + Publishable ("anon") key from the Supabase
 * dashboard → Settings → API. Nothing else in the app needs to change.
 *
 * Never put the Secret ("service_role") key here — that key bypasses
 * Row Level Security and must only ever live in a trusted server
 * environment, which this project deliberately doesn't have.
 */
const SUPABASE_URL = "https://wvdzdcbuflgqnoffslnz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2ZHpkY2J1ZmxncW5vZmZzbG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NzE2NDQsImV4cCI6MjA5OTI0NzY0NH0.1xBQUjuRrZ9gjR1UuLLNbEscXUHCUVXzlhlbdc8PEp4";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
