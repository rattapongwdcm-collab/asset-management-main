import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Monitor, Wrench, PackageOpen, AlertTriangle, CheckCircle, Clock, TrendingUp, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState({ devices: [], repairs: [], rents: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: devices }, { data: repairs }, { data: rents }] = await Promise.all([
        supabase.from('devices').select('*'),
        supabase.from('repairs').select('*'),
        supabase.from('rents').select('*'),
      ]);
      setStats({ devices: devices || [], repairs: repairs || [], rents: rents || [] });
      setLoading(false);
    };
    load();
  }, []);

  const deviceStats = {
    total: stats.devices.length,
    available: stats.devices.filter(d => d.status === 'Available').length,
    inUse: stats.devices.filter(d => d.status === 'In Use').length,
    underRepair: stats.devices.filter(d => d.status === 'Under Repair').length,
  };

  const repairStats = {
    total: stats.repairs.length,
    pending: stats.repairs.filter(r => r.status === 'Pending').length,
    inProgress: stats.repairs.filter(r => r.status === 'In Progress').length,
    completed: stats.repairs.filter(r => r.status === 'Completed').length,
  };

  const rentStats = {
    total: stats.rents.length,
    active: stats.rents.filter(r => r.status === 'Active').length,
    overdue: stats.rents.filter(r => r.status === 'Overdue').length,
    returned: stats.rents.filter(r => r.status === 'Returned').length,
  };

  const summaryCards = [
    {
      label: 'อุปกรณ์ทั้งหมด',
      value: deviceStats.total,
      sub: `${deviceStats.available} พร้อมใช้`,
      icon: Monitor,
      color: '#3b82f6',
      bg: 'rgba(59,130,246,0.1)',
      link: '/device',
    },
    {
      label: 'งานซ่อม',
      value: repairStats.total,
      sub: `${repairStats.pending} รอดำเนินการ`,
      icon: Wrench,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.1)',
      link: '/repair',
    },
    {
      label: 'การยืม',
      value: rentStats.total,
      sub: `${rentStats.active} กำลังยืม`,
      icon: PackageOpen,
      color: '#10b981',
      bg: 'rgba(16,185,129,0.1)',
      link: '/rent',
    },
    {
      label: 'เกินกำหนด',
      value: rentStats.overdue,
      sub: 'รอการคืน',
      icon: AlertTriangle,
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.1)',
      link: '/rent',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground font-heading">Dashboard</h2>
        <p className="text-muted-foreground text-sm mt-1">ภาพรวมระบบจัดการ IT Assets</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {summaryCards.map(card => (
          <Link to={card.link} key={card.label}>
            <div className="rounded-xl p-5 bg-card border border-border hover:shadow-lg transition-all duration-200 cursor-pointer group">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</p>
                  <p className="text-3xl font-bold mt-1 text-foreground">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                </div>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200"
                  style={{ background: card.bg }}
                >
                  <card.icon size={20} style={{ color: card.color }} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Monitor size={16} className="text-blue-500" />
            <h3 className="font-semibold text-sm text-foreground">สถานะอุปกรณ์</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: 'พร้อมใช้', value: deviceStats.available, total: deviceStats.total, color: '#10b981' },
              { label: 'กำลังใช้งาน', value: deviceStats.inUse, total: deviceStats.total, color: '#3b82f6' },
              { label: 'กำลังซ่อม', value: deviceStats.underRepair, total: deviceStats.total, color: '#f59e0b' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium text-foreground">{item.value}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: deviceStats.total ? `${(item.value / deviceStats.total) * 100}%` : '0%',
                      background: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wrench size={16} className="text-amber-500" />
            <h3 className="font-semibold text-sm text-foreground">สถานะงานซ่อม</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: 'รอดำเนินการ', value: repairStats.pending, color: '#f59e0b', icon: Clock },
              { label: 'กำลังซ่อม', value: repairStats.inProgress, color: '#3b82f6', icon: Activity },
              { label: 'ซ่อมเสร็จ', value: repairStats.completed, color: '#10b981', icon: CheckCircle },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon size={14} style={{ color: item.color }} />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: `${item.color}20`, color: item.color }}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <PackageOpen size={16} className="text-emerald-500" />
            <h3 className="font-semibold text-sm text-foreground">สถานะการยืม</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: 'กำลังยืม', value: rentStats.active, color: '#10b981', icon: Activity },
              { label: 'เกินกำหนด', value: rentStats.overdue, color: '#ef4444', icon: AlertTriangle },
              { label: 'คืนแล้ว', value: rentStats.returned, color: '#6b7280', icon: CheckCircle },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon size={14} style={{ color: item.color }} />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: `${item.color}20`, color: item.color }}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {stats.repairs.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              <h3 className="font-semibold text-sm text-foreground">งานซ่อมล่าสุด</h3>
            </div>
            <Link to="/repair" className="text-xs text-blue-500 hover:underline">ดูทั้งหมด →</Link>
          </div>
          <div className="space-y-2">
            {stats.repairs.slice(0, 5).map(r => {
              const colors = { Pending: '#f59e0b', 'In Progress': '#3b82f6', Completed: '#10b981', Cancelled: '#6b7280', 'Waiting Parts': '#8b5cf6' };
              const color = colors[r.status] || '#6b7280';
              return (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.device_name}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-xs">{r.issue_description}</p>
                  </div>
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ml-4"
                    style={{ background: `${color}20`, color }}
                  >
                    {r.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}