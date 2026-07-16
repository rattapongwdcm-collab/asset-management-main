import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Monitor, Wrench, PackageOpen, TrendingUp, Laptop, Printer, Wifi, Server, Smartphone, Tablet, Package, LayoutDashboard, PackageX } from 'lucide-react';
import { Link } from 'react-router-dom';

// ✅ ตั้งค่าหมวดหมู่อุปกรณ์แบบ static ไว้นอก component ก็ได้ (ไม่พึ่ง state/props เลย)
// แต่เก็บไว้ในนี้ตามเดิมเพื่อไม่ให้กระทบโครงสร้างไฟล์อื่นที่อาจ import ไปใช้
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

// ✅ สีประจำสถานะงานซ่อม แยกออกมานอก component เพื่อไม่ต้องสร้าง object ใหม่ทุกครั้งที่ re-render
const repairStatusColors = {
  Pending: '#f59e0b',
  'In Progress': '#3b82f6',
  Completed: '#10b981',
  Cancelled: '#6b7280',
  'Waiting Parts': '#8b5cf6',
};

export default function Dashboard() {
  // เพิ่ม accessories เข้ามาใน state เดียวกับ devices/repairs
  const [stats, setStats] = useState({ devices: [], repairs: [], accessories: [] });
  const [loading, setLoading] = useState(true);

  // ดึงข้อมูลอุปกรณ์, งานซ่อม และอุปกรณ์เสริมทั้งหมดมาคำนวณสรุปในหน้านี้
  useEffect(() => {
    const load = async () => {
      const [{ data: devices }, { data: repairs }, { data: accessories }] = await Promise.all([
        supabase.from('devices').select('*'),
        supabase.from('repairs').select('*'),
        supabase.from('accessories').select('*'),
      ]);
      setStats({ devices: devices || [], repairs: repairs || [], accessories: accessories || [] });
      setLoading(false);
    };
    load();
  }, []);

  // ✅ สรุปจำนวนอุปกรณ์ — เหลือเฉพาะค่าที่ถูกใช้จริงในหน้านี้ (total, available)
  const deviceStats = {
    total: stats.devices.length,
    available: stats.devices.filter(d => d.status === 'สำรอง').length,
  };

  // ✅ สรุปจำนวนงานซ่อม — เหลือเฉพาะค่าที่ถูกใช้จริงในหน้านี้ (total, pending)
  const repairStats = {
    total: stats.repairs.length,
    pending: stats.repairs.filter(r => r.status === 'Pending').length,
  };

  // 📦 สรุปจำนวนอุปกรณ์เสริม — จำนวนชนิดทั้งหมด + จำนวนชนิดที่สถานะ "หมด" (quantity = 0)
  const accessoryStats = {
    total: stats.accessories.length,
    outOfStock: stats.accessories.filter(a => a.status === 'หมด').length,
  };

  // รายการอุปกรณ์เสริมที่หมดสต็อก ใช้โชว์เป็น warning list ด้านล่าง (เรียงชื่อ ก-ฮ ให้หาง่าย)
  const outOfStockAccessories = stats.accessories
    .filter(a => a.status === 'หมด')
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'));

  // 📊 แยกจำนวนอุปกรณ์ตามประเภท (category) จากข้อมูลจริงในทะเบียน
  // อุปกรณ์ที่ category ไม่ตรงกับหมวดที่รู้จัก จะถูกจัดเข้ากลุ่ม 'Other' อัตโนมัติ
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

  // การ์ดสรุปด้านบนสุด: อุปกรณ์ทั้งหมด / งานซ่อม / อุปกรณ์เสริม
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
      label: 'อุปกรณ์เสริม',
      value: accessoryStats.total,
      sub: `${accessoryStats.outOfStock} หมดสต็อก`,
      icon: PackageOpen,
      color: '#10b981',
      bg: 'rgba(16,185,129,0.1)',
      link: '/accessories',
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
      {/* หัวข้อหน้า */}
      <div>
        <h2 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
          <LayoutDashboard className="text-primary" size={22} />
          รายการอุปกรณ์
        </h2>
      </div>

      {/* การ์ดสรุปด้านบน: อุปกรณ์ทั้งหมด / งานซ่อม / อุปกรณ์เสริม */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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

      {/* จำนวนอุปกรณ์แยกตามประเภท */}
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

      {/* อุปกรณ์เสริมที่หมดสต็อก — แสดงเฉพาะตอนมีรายการหมดจริง (เหมือน pattern งานซ่อมล่าสุดด้านล่าง) */}
      {outOfStockAccessories.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PackageX size={16} className="text-red-500" />
              <h3 className="font-semibold text-sm text-foreground">อุปกรณ์เสริมที่หมดสต็อก</h3>
            </div>
            <Link to="/accessories" className="text-xs text-blue-500 hover:underline">ดูทั้งหมด →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {outOfStockAccessories.map(a => (
              <div
                key={a.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg border border-border"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.brand || '-'}</p>
                </div>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ml-2 bg-rose-50 text-rose-600">
                  หมด
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* งานซ่อมล่าสุด 5 รายการ — แสดงเฉพาะตอนมีข้อมูลงานซ่อมอยู่จริง */}
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
              const color = repairStatusColors[r.status] || '#6b7280';
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