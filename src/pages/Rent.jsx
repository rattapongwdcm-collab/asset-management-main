// import React, { useState, useEffect } from 'react';
// import { supabase } from '@/lib/supabase';
// import { Plus, Search, Key } from 'lucide-react';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { Label } from '@/components/ui/label';
// import { Textarea } from '@/components/ui/textarea';

// const statusColors = {
//   'รออนุมัติให้ยืม': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', text: 'รออนุมัติให้ยืม' },
//   'ยืม': { bg: 'rgba(16,185,129,0.12)', color: '#10b981', text: 'กำลังยืม' },
//   'Returned': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', text: 'คืนแล้ว' },
// };

// const departments = ['IT', 'HR', 'Accounting', 'Marketing', 'Sales', 'Operations', 'Purchasing'];

// export default function Rent() {
//   const [rents, setRents] = useState([]);
//   const [devices, setDevices] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [search, setSearch] = useState('');
//   const [isModalOpen, setIsModalOpen] = useState(false);

//   const [form, setForm] = useState({
//     device_id: '',
//     device_name: '',
//     rented_by: '',
//     department: '',
//     purpose: '',
//     start_date: '',
//     return_date: '',
//   });

//   const [errors, setErrors] = useState({});

//   const loadData = async () => {
//     setLoading(true);
//     try {
//       const [rentsRes, devicesRes] = await Promise.all([
//         supabase.from('rents').select('*').order('created_at', { ascending: false }),
//         supabase.from('devices').select('id, asset_tag, name, assigned_to, status')
//       ]);
//       setRents(rentsRes.data || []);
//       setDevices(devicesRes.data || []);
//     } catch (err) {
//       console.error("Error loading rent data:", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     loadData();
//     const rentChannel = supabase
//       .channel('rents-realtime')
//       .on('postgres_changes', { event: '*', schema: 'public', table: 'rents' }, () => { loadData(); })
//       .subscribe();
//     return () => { supabase.removeChannel(rentChannel); };
//   }, []);

//   const handleDeviceChange = (deviceId) => {
//     const selectedDevice = devices.find(d => d.id === deviceId);
//     if (selectedDevice) {
//       setForm(prev => ({ ...prev, device_id: deviceId, device_name: selectedDevice.name }));
//       setErrors(prev => ({ ...prev, device_id: "" }));
//     }
//   };

//   const handleSubmitData = async () => {
    
//     let tempErrors = {};

//     if (!form.device_id) tempErrors.device_id = "กรุณาเลือกอุปกรณ์";
//     if (!form.rented_by.trim()) tempErrors.rented_by = "กรุณากรอกชื่อผู้ขอยืม";
//     if (!form.department) tempErrors.department = "กรุณาเลือกแผนก";
//     if (!form.return_date) tempErrors.return_date = "กรุณาเลือกกำหนดส่งคืน";

//     const today = new Date();
//     const formattedToday = today.toLocaleDateString('en-CA');

//     if (!form.start_date) {
//       tempErrors.start_date = "กรุณาเลือกวันที่เริ่มยืม";
//     } else if (form.start_date !== formattedToday) {
//       tempErrors.start_date = "วันที่เริ่มยืมจะต้องเป็นวันปัจจุบันเท่านั้น";
//     }

//     if (form.start_date && form.return_date && new Date(form.return_date) < new Date(form.start_date)) {
//       tempErrors.return_date = "กำหนดส่งคืนต้องไม่น้อยกว่าวันที่เริ่มยืม";
//     }

//     if (Object.keys(tempErrors).length > 0) {
//       setErrors(tempErrors);
//       return;
//     }

//     setErrors({});
//     setSaving(true);

//     try {
//       const { error: insertRentError } = await supabase
//         .from('rents')
//         .insert([
//           {
//             device_id: form.device_id,
//             device_name: form.device_name,
//             borrower_name: form.rented_by.trim(),
//             borrower_department: form.department,
//             purpose: form.purpose.trim() || null,
//             borrow_date: form.start_date,
//             due_date: form.return_date,
//             status: 'รออนุมัติให้ยืม'
//           }
//         ]);

//       if (insertRentError) throw insertRentError;

//       const { error: insertApprovalError } = await supabase
//         .from('approvals')
//         .insert([
//           {
//             device_id: form.device_id,
//             device_name: form.device_name,
//             request_type: 'Rent',
//             requested_by: form.rented_by.trim(),
//             description: `แผนก: ${form.department} | วัตถุประสงค์: ${form.purpose || 'ยืมเคลื่อนย้าย'}`,
//             note: `ขอยืมใช้ตั้งแต่วันที่ ${form.start_date} ถึง ${form.return_date}`,
//             status: 'Pending'
//           }
//         ]);

//       if (insertApprovalError) throw insertApprovalError;

//       await supabase
//         .from('devices')
//         .update({ status: 'กำลังขออนุมัติยืม' })
//         .eq('id', form.device_id);

//       setForm({ device_id: '', device_name: '', rented_by: '', department: '', purpose: '', start_date: '', return_date: '' });
//       setErrors({});
//       setIsModalOpen(false);
//       loadData();

//     } catch (err) {
//       console.error("Error from Supabase process:", err);
//       alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + (err.details || err.message));
//     } finally {
//       setSaving(false);
//     }
//   };

//   const filtered = rents.filter(r => {
//     const searchStr = search.toLowerCase().trim();
//     if (!searchStr) return true;
//     const d = devices.find(dev => dev.id === r.device_id);
//     return (
//       (r.device_name || d?.name || '').toLowerCase().includes(searchStr) ||
//       (d?.asset_tag || '').toLowerCase().includes(searchStr) ||
//       (r.borrower_name || '').toLowerCase().includes(searchStr) ||
//       (r.borrower_department || '').toLowerCase().includes(searchStr) ||
//       (r.status || '').toLowerCase().includes(searchStr)
//     );
//   });

//   return (
//     <div className="space-y-5">
//       <div className="flex items-center justify-between">
//         <h2 className="text-2xl font-bold flex items-center gap-2">
//           <Key className="text-primary" /> รายการยืม-คืนอุปกรณ์ IT
//         </h2>
//         <Button onClick={() => setIsModalOpen(true)} className="gap-1.5">
//           <Plus size={16} /> ยืมอุปกรณ์
//         </Button>
//       </div>

//       <div className="relative">
//         <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
//         <Input
//           placeholder="ค้นหารหัสเครื่อง, ชื่อผู้ยืม, แผนก หรือสถานะ..."
//           className="pl-10"
//           value={search}
//           onChange={e => setSearch(e.target.value)}
//         />
//       </div>

//       <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
//         <table className="w-full text-sm">
//           {/* เพิ่มส่วนหัวตารางเพื่อจัดตำแหน่งคอลัมน์ให้ตรงตามข้อมูล */}
//           <thead className="bg-muted/50 border-b">
//             <tr>
//               <th className="px-4 py-3 text-left font-medium text-muted-foreground">รหัสอุปกรณ์</th>
//               <th className="px-4 py-3 text-left font-medium text-muted-foreground">ชื่ออุปกรณ์</th>
//               <th className="px-4 py-3 text-left font-medium text-muted-foreground">ผู้ขอยืม</th>
//               <th className="px-4 py-3 text-left font-medium text-muted-foreground">แผนก</th>
//               <th className="px-4 py-3 text-left font-medium text-muted-foreground">ระยะเวลาการยืม</th>
//               <th className="px-4 py-3 text-left font-medium text-muted-foreground">สถานะ</th>
//             </tr>
//           </thead>
//           <tbody className="divide-y">
//             {loading ? (
//               <tr><td colSpan="6" className="text-center py-4">กำลังโหลด...</td></tr>
//             ) : filtered.length === 0 ? (
//               <tr><td colSpan="6" className="text-center py-4">ไม่พบข้อมูล</td></tr>
//             ) : (
//               filtered.map(r => {
//                 const d = devices.find(dev => dev.id === r.device_id);
//                 const sc = statusColors[r.status] || { bg: 'rgba(107,114,128,0.12)', color: '#6b7280', text: r.status };
//                 return (
//                   <tr key={r.id} className="hover:bg-muted/30">
//                     <td className="px-4 py-3 font-mono text-xs">{d?.asset_tag || '-'}</td>
//                     <td className="px-4 py-3 font-medium">{r.device_name}</td>
//                     {/* 🔑 แก้ไขจุดแสดงผลตรงนี้ให้ดึงจากฟิลด์ใน Database จริง */}
//                     <td className="px-4 py-3">{r.borrower_name || '-'}</td>
//                     <td className="px-4 py-3">{r.borrower_department || '-'}</td>
//                     <td className="px-4 py-3 text-xs text-muted-foreground">
//                       {r.borrow_date || '-'} ถึง {r.due_date || '-'}
//                     </td>
//                     <td className="px-4 py-3">
//                       <span className="px-2 py-1 rounded-full text-[11px] font-semibold" style={{ background: sc.bg, color: sc.color }}>
//                         {sc.text}
//                       </span>
//                     </td>
//                   </tr>
//                 );
//               })
//             )}
//           </tbody>
//         </table>
//       </div>

//       {/* MODAL ฟอร์มบันทึกการยืม */}
//       <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if(!open) setErrors({}); }}>
//         <DialogContent className="sm:max-w-[480px]">
//           <DialogHeader>
//             <DialogTitle className="flex items-center gap-2">
//               <Key size={18} className="text-primary" />
//               <span>บันทึกขอขอยืมอุปกรณ์ IT</span>
//             </DialogTitle>
//           </DialogHeader>

//           <div className="space-y-4 py-2">
//             {/* เลือกอุปกรณ์ */}
//             <div className="space-y-1.5">
//               <Label className={`text-[11px] font-bold flex items-center gap-1 ${errors.device_id ? "text-red-500" : "text-foreground/80"}`}>
//                 เลือกอุปกรณ์ในระบบ IT <span className="text-red-500">*</span>
//               </Label>
//               <Select value={form.device_id} onValueChange={handleDeviceChange}>
//                 <SelectTrigger className={`h-9 text-xs transition-colors ${errors.device_id ? "border-red-500 bg-red-50/10 focus:ring-red-500 text-red-500" : ""}`}>
//                   <SelectValue placeholder="ค้นหาและเลือกตามรหัสทรัพย์สิน หรือ ชื่อเครื่อง" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   {devices.filter(dev => dev.status === 'ปกติ' || dev.status === 'สำรอง').map((dev) => (
//                     <SelectItem key={dev.id} value={dev.id} className="text-xs">
//                       [{dev.asset_tag || 'ไม่มีรหัส'}] {dev.name}
//                     </SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//             </div>

//             {/* ชื่อผู้ยืม */}
//             <div className="space-y-1.5">
//               <Label className={`text-[11px] font-bold flex items-center gap-1 ${errors.rented_by ? "text-red-500" : "text-foreground/80"}`}>
//                 ชื่อผู้ขอยืม <span className="text-red-500">*</span>
//               </Label>
//               <Input
//                 value={form.rented_by}
//                 className={`h-9 text-xs transition-colors ${errors.rented_by ? "border-red-500 bg-red-50/20 text-red-500 focus-visible:ring-red-500" : ""}`}
//                 onChange={e => { setForm(prev => ({ ...prev, rented_by: e.target.value })); setErrors(prev => ({ ...prev, rented_by: "" })); }}
//                 placeholder="กรอกชื่อ-นามสกุล ผู้ขอยืม"
//               />
//             </div>

//             {/* แผนก */}
//             <div className="space-y-1.5">
//               <Label className={`text-[11px] font-bold flex items-center gap-1 ${errors.department ? "text-red-500" : "text-foreground/80"}`}>
//                 แผนกที่นำไปใช้ <span className="text-red-500">*</span>
//               </Label>
//               <Select value={form.department} onValueChange={value => { setForm(prev => ({ ...prev, department: value })); setErrors(prev => ({ ...prev, department: "" })); }}>
//                 <SelectTrigger className={`h-9 text-xs transition-colors ${errors.department ? "border-red-500 bg-red-50/10 focus:ring-red-500 text-red-500" : ""}`}>
//                   <SelectValue placeholder="เลือกแผนก" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   {departments.map((dept) => (
//                     <SelectItem key={dept} value={dept} className="text-xs">{dept}</SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//             </div>

//             {/* วัตถุประสงค์ */}
//             <div className="space-y-1.5">
//               <Label className="text-[11px] font-bold text-foreground/80">วัตถุประสงค์ในการยืมเคลื่อนย้าย</Label>
//               <Textarea
//                 value={form.purpose}
//                 onChange={e => setForm(prev => ({ ...prev, purpose: e.target.value }))}
//                 placeholder="ระบุเหตุผลความจำเป็นในการยืมเครื่อง..."
//                 className="text-xs min-h-[60px] resize-none"
//               />
//             </div>

//             {/* วันเริ่มยืม - วันที่คืน */}
//             <div className="grid grid-cols-2 gap-3">
//               {/* ช่องวันที่เริ่มยืม */}
//               <div className="space-y-1.5 pb-5 relative">
//                 <Label className={`text-[11px] font-bold flex items-center gap-1 ${errors.start_date ? "text-red-500" : "text-foreground/80"}`}>
//                   วันที่เริ่มยืม <span className="text-red-500">*</span>
//                 </Label>
//                 <Input
//                   type="date"
//                   value={form.start_date || ""}
//                   className={`h-9 text-xs rounded-md font-mono transition-colors ${
//                     errors.start_date 
//                       ? "border-red-500 bg-red-50/20 text-red-500 focus-visible:ring-red-500" 
//                       : "focus-visible:ring-primary"
//                   }`}
//                   onChange={(e) => { setForm(prev => ({ ...prev, start_date: e.target.value })); setErrors(prev => ({ ...prev, start_date: "" })); }}
//                 />
//                 <div className="absolute bottom-0 left-0 h-4 flex items-center">
//                   {errors.start_date && (
//                     <p className="text-[10px] font-medium text-red-500 leading-none">{errors.start_date}</p>
//                   )}
//                 </div>
//               </div>

//               {/* ช่องกำหนดส่งคืน */}
//               <div className="space-y-1.5 pb-5 relative">
//                 <Label className={`text-[11px] font-bold flex items-center gap-1 ${errors.return_date ? "text-red-500" : "text-foreground/80"}`}>
//                   กำหนดส่งคืน <span className="text-red-500">*</span>
//                 </Label>
//                 <Input
//                   type="date"
//                   value={form.return_date || ""}
//                   className={`h-9 text-xs rounded-md font-mono transition-colors ${
//                     errors.return_date 
//                       ? "border-red-500 bg-red-50/20 text-red-500 focus-visible:ring-red-500" 
//                       : "focus-visible:ring-primary"
//                   }`}
//                   onChange={(e) => { setForm(prev => ({ ...prev, return_date: e.target.value })); setErrors(prev => ({ ...prev, return_date: "" })); }}
//                 />
//                 <div className="absolute bottom-0 left-0 h-4 flex items-center">
//                   {errors.return_date && (
//                     <p className="text-[10px] font-medium text-red-500 leading-none">{errors.return_date}</p>
//                   )}
//                 </div>
//               </div>
//             </div>

//           </div>

//           <DialogFooter className="pt-2 gap-2 sm:gap-0">
//             <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="text-xs">ยกเลิก</Button>
//             <Button type="button" onClick={handleSubmitData} disabled={saving} className="text-xs">
//               {saving ? 'กำลังส่งคำขอ...' : 'ส่งขออนุมัติยืม'}
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }