import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { LayoutDashboard, Monitor, Wrench, PackageOpen, LogOut, Server, ClipboardCheck, History, Menu, X, ShieldCheck, Pencil } from 'lucide-react';
import SessionGuard from './SessionGuard';   // ✅ เพิ่ม import

const baseNavItems = [
  { label: 'แดชบอร์ด', path: '/', icon: LayoutDashboard },
  { label: 'อุปกรณ์', path: '/device', icon: Monitor },
  { label: 'อุปกรณ์เสริม', path: '/accessories', icon: PackageOpen },
  { label: 'ซ่อมบำรุง', path: '/repair', icon: Wrench },
  // { label: 'เช่า', path: '/rent', icon: PackageOpen },
];

export default function Layout() {
  const location = useLocation();
  const [navItems, setNavItems] = useState(baseNavItems);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // ✅ ควบคุมการเปิด/ปิดเมนูมือถือ

  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'admin') {
        setIsAdmin(true);
        setNavItems([
          ...baseNavItems,
          { label: 'อนุมัติ', path: '/approve', icon: ClipboardCheck },
          { label: 'ประวัติ', path: '/history', icon: History },
          { label: 'บัญชีผู้ใช้', path: '/admin/accounts', icon: ShieldCheck },
          { label: 'แก้ไขอุปกรณ์', path: '/admin/devices', icon: Pencil }
        ]);
      }
    };

    checkUserRole();
  }, []);

  // ✅ ปิดเมนูอัตโนมัติทุกครั้งที่เปลี่ยนหน้า (กันเมนูค้างเปิดหลังกดลิงก์บนมือถือ)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: 'hsl(var(--background))' }}>
      <SessionGuard />
      {/* ✅ Overlay สีดำจางๆ เมื่อเปิดเมนูบนมือถือ กดเพื่อปิด */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar: บนจอใหญ่แสดงตลอด (lg:translate-x-0), บนมือถือเลื่อนเข้า-ออกด้วย translate + fixed */}
      <aside
        className={`
          w-64 flex flex-col shrink-0 shadow-2xl
          fixed lg:static inset-y-0 left-0 z-50
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        `}
        style={{ background: 'hsl(var(--sidebar-bg))' }}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'hsl(var(--accent))' }}>
            <Server size={18} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'hsl(var(--accent))' }}>IT</p>
            <p className="text-sm font-bold leading-tight text-white">Asset Management</p>
          </div>

          {/* ✅ ปุ่มปิด (X) แสดงเฉพาะบนมือถือ อยู่ในแถบหัว sidebar */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-white/70 hover:text-white p-1"
          >
            <X size={20} />
          </button>
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
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 flex items-center px-4 lg:px-8 shrink-0 shadow-md gap-3" style={{ background: 'hsl(var(--header-bg))' }}>

          {/* ✅ ปุ่มขีด 3 ขีด (hamburger) แสดงเฉพาะบนมือถือ/แท็บเล็ต */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-white/80 hover:text-white p-1 -ml-1"
          >
            <Menu size={22} />
          </button>

          <h1 className="text-white font-heading font-semibold text-base tracking-wide truncate">Asset Management</h1>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
            <span className="text-xs hidden sm:inline" style={{ color: 'hsl(var(--sidebar-text))' }}>
              System Online {isAdmin && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded ml-1 font-bold">ADMIN</span>}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}