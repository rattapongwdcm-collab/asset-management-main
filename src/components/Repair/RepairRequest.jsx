// import React, { useState, useEffect } from 'react';
// import { supabase } from '@/lib/supabase';
// import { Wrench, Search, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';

// const statusColors = {
//   'Pending': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', text: 'กำลังซ่อม' },
//   'In Progress': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', text: 'กำลังซ่อม' },
//   'Waiting Parts': { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6', text: 'กำลังซ่อม' },
//   'Completed': { bg: 'rgba(16,185,129,0.12)', color: '#10b981', text: 'ซ่อมเสร็จสิ้น' },
//   'Cancelled': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', text: 'เสีย' },
// };

// export default function RepairRequest() {
//   const [requests, setRequests] = useState([]); // ดึงข้อมูลจากตาราง repairs จริงในระบบ
//   const [devices, setDevices] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [search, setSearch] = useState('');

//   const loadData = async () => {
//     setLoading(true);
//     try {
//       // 🟢 แก้ไขจุดที่ 1: เปลี่ยนชื่อตารางเป็น 'repairs' ให้ตรงกับ Database ของคุณ
//       const [repairsRes, devicesRes] = await Promise.all([
//         supabase.from('repairs').select('*').order('created_at', { ascending: false }),
//         supabase.from('devices').select('id, asset_tag, name, assigned_to')
//       ]);

//       setRequests(repairsRes.data || []);
//       setDevices(devicesRes.data || []);
//     } catch (err) {
//       console.error("Error loading repair data:", err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     loadData();
//   }, []);

//   // --- ระบบค้นหาข้อมูล Real-time ดึงตามข้อมูลปัจจุบันของตาราง Devices ---
//   const filteredRequests = requests.filter(r => {
//     const d = devices.find(dev => String(dev.id) === String(r.device_id));
//     const searchStr = search.toLowerCase();

//     const assetTag = d?.asset_tag || '';
//     const deviceName = d?.name || r.device_name || '';

//     return (
//       deviceName.toLowerCase().includes(searchStr) ||
//       assetTag.toLowerCase().includes(searchStr)
//     );
//   });

//   const handleSubmit = async (e) => {
//     e.preventDefault();

//     if (!formData.device_id) return alert("กรุณาเลือกอุปกรณ์");

//     setSubmitting(true);
//     try {
//       const selectedDevice = devices.find(d => d.id === formData.device_id);

//       // 🟢 1. ส่งข้อมูลเข้าตารางพักเพื่อรอ Approve
//       const { error } = await supabase
//         .from('repair_requests') // ตารางสำหรับเก็บประวัติรออนุมัติ
//         .insert([{
//           device_id: formData.device_id,
//           device_name: selectedDevice?.name,
//           reported_by: user?.email, // บัญชีผู้ดำเนินการ
//           issue_description: formData.problem_description, // อาการเสีย
//           status: 'Pending Approval', // 🟡 ตั้งสถานะเป็น "รออนุมัติ"
//           created_at: new Date().toISOString()
//         }]);

//       if (error) throw error;

//       // 🟢 2. ปรับสถานะอุปกรณ์ในตาราง devices ให้เป็น "รอตรวจสอบ" ไม่ให้คนอื่นกดซ้ำ
//       await supabase
//         .from('devices')
//         .update({ status: 'รอตรวจสอบ' })
//         .eq('id', formData.device_id);

//       alert("📋 ส่งข้อมูลเข้าสู่ระบบเพื่อรออนุมัติ (Approve) เรียบร้อยแล้ว");
//       // รีเซ็ตฟอร์ม...
//     } catch (err) {
//       alert("เกิดข้อผิดพลาด: " + err.message);
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   return (
//     <div className="space-y-5 animate-in fade-in duration-200">
//       <div className="flex items-center justify-between">
//         <h2 className="text-2xl font-bold flex items-center gap-2">
//           <Wrench className="text-primary" size={24} />
//           <span>รายการซ่อมและจัดการสถานะอุปกรณ์</span>
//         </h2>
//       </div>

//       <div className="relative">
//         <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
//         <Input
//           placeholder="ค้นหาด้วยรหัสอุปกรณ์ หรือ ชื่ออุปกรณ์..."
//           className="pl-10"
//           value={search}
//           onChange={e => setSearch(e.target.value)}
//         />
//       </div>

//       <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
//         <table className="w-full text-sm">
//           <thead className="bg-muted/50">
//             <tr>
//               <th className="px-4 py-3 text-left">รหัสอุปกรณ์</th>
//               <th className="px-4 py-3 text-left">ชื่ออุปกรณ์</th>
//               <th className="px-4 py-3 text-left">ผู้ถือครอง</th>
//               <th className="px-4 py-3 text-left">บัญชีผู้ดำเนินการ</th>
//               <th className="px-4 py-3 text-left">อาการเสีย / ปัญหา</th>
//               <th className="px-4 py-3 text-left">暗สถานะ</th>
//               <th className="px-4 py-3 text-center">จัดการ</th>
//             </tr>
//           </thead>
//           <tbody className="divide-y">
//             {loading ? (
//               <tr>
//                 <td colSpan="7" className="text-center py-10 text-muted-foreground">
//                   <div className="flex items-center justify-center gap-2">
//                     <Loader2 size={16} className="animate-spin" />
//                     <span>กำลังโหลดข้อมูล...</span>
//                   </div>
//                 </td>
//               </tr>
//             ) : filteredRequests.length === 0 ? (
//               <tr>
//                 <td colSpan="7" className="text-center py-10 text-muted-foreground">
//                   ไม่พบรายการข้อมูลแจ้งซ่อมในระบบ
//                 </td>
//               </tr>
//             ) : (
//               filteredRequests.map(r => {
//                 // ผูก ID ระหว่างตาราง repairs (device_id) และ devices (id) แบบ UUID ตรงตัว
//                 const d = devices.find(dev => String(dev.id) === String(r.device_id));
//                 const sc = statusColors[r.status] || { bg: 'rgba(107,114,128,0.12)', color: '#6b7280', text: r.status };

//                 const isUnderRepair = r.status !== 'Completed' && r.status !== 'Cancelled';

//                 return (
//                   <tr key={r.id} className="hover:bg-muted/30 transition-colors">
//                     {/* 🟢 ดึงข้อมูลสดจากตาราง Devices (ถ้าไม่มีให้ Backup ด้วยคอลัมน์ของตัวเอง) */}
//                     <td className="px-4 py-3 font-mono text-xs">{d?.asset_tag || '-'}</td>
//                     <td className="px-4 py-3 font-medium">{d?.name || r.device_name || '-'}</td>
//                     <td className="px-4 py-3 text-muted-foreground">{d?.assigned_to || '-'}</td>

//                     {/* 🟢 เปลี่ยนเป็น r.reported_by ตามโครงสร้างคอลัมน์จริงในรูป */}
//                     <td className="px-4 py-3 text-muted-foreground">{r.reported_by || '-'}</td>

//                     {/* 🟢 เปลี่ยนเป็น r.issue_description ตามโครงสร้างคอลัมน์จริงในรูป */}
//                     <td className="px-4 py-3 text-muted-foreground max-w-[220px] truncate">
//                       {r.issue_description || '-'}
//                     </td>

//                     <td className="px-4 py-3">
//                       <span className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: sc.bg, color: sc.color }}>
//                         {sc.text}
//                       </span>
//                     </td>

//                     <td className="px-4 py-3 text-center flex justify-center gap-1.5">
//                       {isUnderRepair ? (
//                         <>
//                           {/* 🟢 แก้ไขจุดที่ 2: เปลี่ยนชื่อตารางเป็น 'repairs' ตอน Update */}
//                           <Button
//                             variant="ghost"
//                             size="sm"
//                             className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 gap-1 px-2 border border-emerald-200"
//                             onClick={async () => {
//                               try {
//                                 await supabase.from('repairs').update({ status: 'Completed', updated_at: new Date().toISOString() }).eq('id', r.id);
//                                 await supabase.from('devices').update({ status: 'สำรอง' }).eq('id', r.device_id);
//                                 loadData();
//                               } catch (err) {
//                                 alert("เกิดข้อผิดพลาด: " + err.message);
//                               }
//                             }}
//                           >
//                             <CheckCircle2 size={14} />
//                             <span className="text-xs">ซ่อมได้ (สำรอง)</span>
//                           </Button>

//                           <Button
//                             variant="ghost"
//                             size="sm"
//                             className="text-destructive hover:text-destructive hover:bg-red-50 h-8 gap-1 px-2 border border-red-200"
//                             onClick={async () => {
//                               try {
//                                 await supabase.from('repairs').update({ status: 'Cancelled', updated_at: new Date().toISOString() }).eq('id', r.id);
//                                 await supabase.from('devices').update({ status: 'เสีย' }).eq('id', r.device_id);
//                                 loadData();
//                               } catch (err) {
//                                 alert("เกิดข้อผิดพลาด: " + err.message);
//                               }
//                             }}
//                           >
//                             <XCircle size={14} />
//                             <span className="text-xs">เสีย</span>
//                           </Button>
//                         </>
//                       ) : (
//                         <span className="text-xs text-muted-foreground font-medium py-1">ดำเนินการเสร็จสิ้น</span>
//                       )}
//                     </td>
//                   </tr>
//                 );
//               })
//             )}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// }