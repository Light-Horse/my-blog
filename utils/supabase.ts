import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 🔍 이 줄을 추가해서 브라우저 콘솔(F12)을 확인하세요!
console.log("Supabase Key Check:", supabaseKey); 


export const supabase = createClient(supabaseUrl, supabaseKey);

