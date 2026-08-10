import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Supabase client — null nếu chưa cấu hình env vars.
 * App vẫn hoạt động bình thường (dùng localStorage) khi Supabase chưa được kết nối.
 */
export let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey &&
    supabaseUrl !== 'https://your-project-id.supabase.co') {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.info('[Supabase] Đã kết nối:', supabaseUrl);
} else {
  console.info('[Supabase] Chưa cấu hình — dữ liệu sẽ lưu ở localStorage.');
}

export const isSupabaseEnabled = supabase !== null;
