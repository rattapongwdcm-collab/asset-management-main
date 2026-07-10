import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
// 1. ➕ นำเข้าไอคอน History เข้ามาใช้งานร่วมกับตัวอื่นๆ
import { LayoutDashboard, Monitor, Wrench, PackageOpen, LogOut, Server, ClipboardCheck, History } from 'lucide-react';

// เมนูพื้นฐานสำหรับพนักงานทุกคน
const baseNavItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Device', path: '/device', icon: Monitor },
  { label: 'Repair', path: '/repair', icon: Wrench },
  // { label: 'Rent', path: '/rent', icon: PackageOpen },
];

export default function Layout() {
  const location = useLocation();
  const [navItems, setNavItems] = useState(baseNavItems);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 🟢 ดึง role จากตาราง profiles โดยตรง (แม่นยำกว่า)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'admin') {
      setIsAdmin(true);
      setNavItems([
        ...baseNavItems,
        { label: 'งานรออนุมัติ', path: '/approve', icon: ClipboardCheck },
        { label: 'History', path: '/history', icon: History }
      ]);
    }
  };

  checkUserRole();
}, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: 'hsl(var(--background))' }}>
      <aside className="w-64 flex flex-col shrink-0 shadow-2xl" style={{ background: 'hsl(var(--sidebar-bg))' }}>
        <div className="flex items-center gap-3 px-6 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'hsl(var(--accent))' }}>
            <Server size={18} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'hsl(var(--accent))' }}>IT</p>
            <p className="text-sm font-bold leading-tight text-white">Asset Management</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {navItems.map(({ label, path, icon: Icon }) => {
            const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  color: isActive ? '#fff' : 'hsl(var(--sidebar-text))',
                  background: isActive ? 'hsl(var(--sidebar-active))' : 'transparent',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'hsl(var(--sidebar-hover))'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon size={18} />
                <span>{label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(var(--accent))' }} />}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200"
            style={{ color: 'hsl(var(--sidebar-text))' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,50,50,0.15)'; e.currentTarget.style.color = '#f87171'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'hsl(var(--sidebar-text))'; }}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 flex items-center px-8 shrink-0 shadow-md" style={{ background: 'hsl(var(--header-bg))' }}>
          <h1 className="text-white font-heading font-semibold text-base tracking-wide">Asset Management</h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
            <span className="text-xs" style={{ color: 'hsl(var(--sidebar-text))' }}>
              System Online {isAdmin && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded ml-1 font-bold">ADMIN</span>}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}