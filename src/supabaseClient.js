import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vxohgwjzrhnwdoseqcro.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4b2hnd2p6cmhud2Rvc2VxY3JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyODkyMjYsImV4cCI6MjA3Nzg2NTIyNn0.kuOOrB53vrzwKHq0E83ihGd5HdvPRdu4ix05oSD5d2I";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);