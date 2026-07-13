import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Monitor, Wrench, PackageOpen, AlertTriangle, CheckCircle, Clock, TrendingUp, Activity, Laptop, Printer, Wifi, Server, Smartphone, Tablet, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState({ devices: [], repairs: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: devices }, { data: repairs }] = await Promise.all([
        supabase.from('devices').select('*'),
        supabase.from('repairs').select('*'),
      ]);
      setStats({ devices: devices || [], repairs: repairs || [] });
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

  // 📊 แยกจำนวนอุปกรณ์ตามประเภท (category) จากข้อมูลจริงในทะเบียน
  const categoryConfig = [
    { key: 'Laptop', label: 'Laptop', icon: Laptop, color: '#3b82f6' },
    { key: 'Desktop', label: 'Desktop', icon: Monitor, color: '#6366f1' },
    { key: 'Monitor', label: 'Monitor', icon: Monitor, color: '#8b5cf6' },
    { key: 'Printer', label: 'Printer', icon: Printer, color: '#ec4899' },
    { key: 'Network', label: 'Network', icon: Wifi, color: '#06b6d4' },
    { key: 'Server', label: 'Server', icon: Server, color: '#f59e0b' },
    { key: 'Mobile', label: 'Mobile', icon: Smartphone, color: '#10b981' },
    { key: 'Tablet', label: 'Tablet', icon: Tablet, color: '#14b8a6' },
    { key: 'Other', label: 'Other', icon: Package, color: '#6b7280' },
  ];

  const knownKeys = categoryConfig.map(c => c.key);
  const categoryCounts = stats.devices.reduce((acc, d) => {
    const cat = knownKeys.includes(d.category) ? d.category : 'Other';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const categoryStats = categoryConfig.map(c => ({
    ...c,
    count: categoryCounts[c.key] || 0,
  }));

  // ✅ เหลือแค่ 2 การ์ด: อุปกรณ์ทั้งหมด กับ งานซ่อม (ตัดการ์ด "การยืม" และ "เกินกำหนด" ออก)
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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

      {/* 📊 จำนวนอุปกรณ์แยกตามประเภท */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <PackageOpen size={16} className="text-primary" />
          <h3 className="font-semibold text-sm text-foreground">จำนวนอุปกรณ์แยกตามประเภท</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {categoryStats.map(cat => (
            <div
              key={cat.key}
              className="rounded-lg border border-border p-3 flex items-center gap-3 hover:shadow-sm transition-shadow"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${cat.color}20` }}
              >
                <cat.icon size={16} style={{ color: cat.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{cat.label}</p>
                <p className="text-lg font-bold text-foreground leading-tight">{cat.count}</p>
              </div>
            </div>
          ))}
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