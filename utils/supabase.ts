import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseKey) {
  console.error("🚨 치명적 오류: Supabase 키가 없습니다! 환경변수 설정을 확인하세요.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

