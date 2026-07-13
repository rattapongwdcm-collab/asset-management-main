import React, { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AdminRoute() {
  const [status, setStatus] = useState('loading'); // loading | allowed | denied

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStatus('denied'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setStatus(profile?.role === 'admin' ? 'allowed' : 'denied');
    };
    check();
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (status === 'denied') return <Navigate to="/" replace />;
  return <Outlet />;
}