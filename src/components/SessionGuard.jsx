import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function SessionGuard() {
  useEffect(() => {
    let channel;
    let isMounted = true;

    const forceLogout = async () => {
      localStorage.removeItem('active_session_token');
      await supabase.auth.signOut({ scope: 'local' });
      alert('บัญชีนี้ถูกเข้าสู่ระบบจากอุปกรณ์อื่น ระบบจึงออกจากระบบที่นี่ให้อัตโนมัติ');
      window.location.href = '/login';
    };

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      const localToken = localStorage.getItem('active_session_token');

      // ✅ เช็คทันทีตอนโหลดหน้า เผื่อโดนเตะออกไปแล้วตอนปิดแท็บอยู่ (realtime ไม่ทำงานตอนแท็บปิด)
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_session')
        .eq('id', user.id)
        .single();

      if (profile && localToken && profile.active_session !== localToken) {
        forceLogout();
        return;
      }

      // ✅ ฟัง realtime แบบสด ๆ ระหว่างเปิดแอปอยู่
      channel = supabase
        .channel(`session-guard-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload) => {
            const currentLocalToken = localStorage.getItem('active_session_token');
            if (payload.new.active_session !== currentLocalToken) {
              forceLogout();
            }
          }
        )
        .subscribe();
    };

    setup();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return null; // component นี้ไม่ render อะไรเลย ทำงานเบื้องหลังอย่างเดียว
}