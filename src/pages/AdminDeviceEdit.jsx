import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { logDeviceHistory } from '@/lib/deviceHistory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ImageCropDialog from '@/components/Device/ImageCropDialog';
import ImageUploader from '@/components/Device/ImageUploader';
import { Pencil, X, Check, Search, ChevronDown, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';
const ITEMS_PER_PAGE = 10; // ✅ 10 รายการต่อหน้า
const categories = ['Laptop', 'Desktop', 'Monitor', 'Printer', 'Network', 'Server', 'Mobile', 'Tablet', 'Other'];
const statuses = ['สำรอง', 'ใช้งาน'];
const departments = [
    "Management", "Human Resources", "Admin", "Accounting", "Finance",
    "Information Technology", "Sales", "Modern & Online Trade",
    "International Business", "Export", "Procurement", "Purchasing",
    "Delivery", "Shipping", "Import-Export Logistics", "Warehouse ",
    "Production", "Research & Development", "Quality Control ",
    "Registration & Document Control", "Graphic Design",
];

const statusColors = {
    'ใช้งาน': { bg: '#E0F2FE', color: '#000000' },
    'สำรอง': { bg: '#DCFCE7', color: '#000000' },
    'กำลังซ่อม': { bg: '#FEF3C7', color: '#000000' },
    'รออนุมัติส่งซ่อม': { bg: '#FFE4E6', color: '#9F1239' },
    'ยืม': { bg: '#F3E8FF', color: '#000000' },
    'เสีย': { bg: '#F1F5F9', color: '#000000' },
    'รออนุมัติลบ': { bg: '#FFE4E6', color: '#9F1239' },
    'รออนุมัติแก้ไข': { bg: '#FEF3C7', color: '#D97706' },
    'รออนุมัติเคลื่อนย้าย': { bg: '#FEF3C7', color: '#D97706' },
};

function SearchSelect({ value, options, onSelect, placeholder }) {
    const [search, setSearch] = useState(value || '');
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => { setSearch(value || ''); }, [value]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase().trim()));

    return (
        <div className="relative w-full" ref={ref}>
            <div className="relative">
                <Input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
                    onClick={() => setOpen(true)}
                    placeholder={placeholder}
                    className="h-8 text-xs pr-6"
                />
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground text-center">ไม่พบ</div>
                    ) : (
                        filtered.map(o => (
                            <div
                                key={o}
                                onClick={() => { onSelect(o); setSearch(o); setOpen(false); }}
                                className="px-3 py-2 text-xs cursor-pointer hover:bg-muted/60"
                            >
                                {o}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }) {
    const sc = statusColors[status] || { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' };
    return (
        <span
            className="inline-flex items-center justify-center rounded-full text-[11px] font-medium px-2.5 py-1 shadow-sm"
            style={{ background: sc.bg, color: sc.color }}
        >
            {status || '-'}
        </span>
    );
}

export default function AdminDeviceEdit() {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving] = useState(false);

    // ✅ state สำหรับแบ่งหน้า
    const [currentPage, setCurrentPage] = useState(1);

    const [imageSrc, setImageSrc] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [cropDialogOpen, setCropDialogOpen] = useState(false);

    const load = async () => {
        setLoading(true);
        const { data } = await supabase.from('devices').select('*').order('created_at', { ascending: false });
        setDevices(data || []);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const filtered = devices.filter(d => {
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return (d.name || '').toLowerCase().includes(q) ||
            (d.asset_tag || '').toLowerCase().includes(q) ||
            (d.assigned_to || '').toLowerCase().includes(q);
    });

    // ✅ คำนวณจำนวนหน้าจากผลลัพธ์ที่ค้นหาแล้ว
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

    // ✅ ดีดกลับหน้า 1 อัตโนมัติเมื่อค้นหาใหม่
    useEffect(() => {
        setCurrentPage(1);
    }, [search]);

    // ✅ ดีดกลับหน้า 1 ถ้าหน้าปัจจุบันเกินจำนวนหน้าที่มี (กันหน้าว่างเปล่าค้าง)
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(1);
    }, [totalPages, currentPage]);

    // ✅ ตัดข้อมูลเฉพาะหน้าปัจจุบัน
    const paginatedDevices = filtered.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const startEdit = (device) => {
        setEditingId(device.id);
        setEditForm({ ...device });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setImageSrc(reader.result);
            setCropDialogOpen(true);
        };
        reader.readAsDataURL(file);
    };

    const saveCrop = async () => {
        if (!croppedAreaPixels || !imageSrc) return;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = 300;
        canvas.height = 300;
        const image = new Image();
        image.src = imageSrc;
        image.onload = async () => {
            ctx.drawImage(
                image,
                croppedAreaPixels.x, croppedAreaPixels.y,
                croppedAreaPixels.width, croppedAreaPixels.height,
                0, 0, 300, 300
            );
            canvas.toBlob(async (blob) => {
                const fileName = `${Date.now()}.png`;
                const { error } = await supabase.storage.from("device-images").upload(fileName, blob);
                if (error) {
                    alert("อัปโหลดรูปภาพล้มเหลว: " + error.message);
                    return;
                }
                const { data: { publicUrl } } = supabase.storage.from("device-images").getPublicUrl(fileName);
                setEditForm(f => ({ ...f, image_url: publicUrl }));
                setCropDialogOpen(false);
            });
        };
    };

    const handleSaveRow = async () => {
        if (!editForm.asset_tag?.toString().trim() || !editForm.name?.trim()) {
            alert('กรุณากรอกรหัสอุปกรณ์และชื่ออุปกรณ์');
            return;
        }

        setSaving(true);
        try {
            const original = devices.find(d => d.id === editingId);

            const payload = {
                asset_tag: editForm.asset_tag,
                name: editForm.name,
                assigned_to: editForm.assigned_to,
                department: editForm.department,
                category: editForm.category,
                status: editForm.status,
                purchase_date: editForm.purchase_date || null,
                warranty_expire: editForm.warranty_expire || null,
                purchase_price: editForm.purchase_price || null,
                installation_location: editForm.installation_location || null,
                company: editForm.company,
                company_contact: editForm.company_contact,
                image_url: editForm.image_url || null,
            };

            const { error } = await supabase.from('devices').update(payload).eq('id', editingId);
            if (error) throw error;

            const changedLabels = {
                asset_tag: 'รหัสอุปกรณ์', name: 'ชื่ออุปกรณ์', assigned_to: 'ผู้รับมอบหมาย',
                department: 'แผนก', category: 'ประเภท', status: 'สถานะ',
                purchase_date: 'วันที่ซื้อ', warranty_expire: 'วันหมดประกัน',
                purchase_price: 'ราคาที่ซื้อ', installation_location: 'สถานที่ติดตั้ง',
                company: 'บริษัท', company_contact: 'เบอร์ติดต่อ', image_url: 'รูปภาพ',
            };
            const changedFields = Object.keys(payload).filter(k => (original?.[k] ?? '') !== (payload[k] ?? ''));

            if (changedFields.length > 0) {
                await logDeviceHistory({
                    deviceId: editingId,
                    assetTag: payload.asset_tag,
                    deviceName: payload.name,
                    action: 'edit',
                    description: `Admin แก้ไขข้อมูลโดยตรง: ${changedFields.map(k => changedLabels[k] || k).join(', ')}`,
                });
            }

            await load();
            setEditingId(null);
            setEditForm({});
        } catch (err) {
            alert('บันทึกไม่สำเร็จ: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const formatPrice = (price) => {
        if (price === null || price === undefined || price === "") return "-";
        const num = Number(price);
        if (isNaN(num)) return "-";
        return num.toLocaleString('th-TH');
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
                        <ShieldAlert className="text-primary" size={22} />
                        แก้ไขอุปกรณ์ (Admin)
                    </h2>
                </div>
            </div>

            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="ค้นหาชื่อ, รหัสอุปกรณ์, ผู้รับมอบหมาย..." className="pl-9 h-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {paginatedDevices.map(device => {
                        const isEditing = editingId === device.id;
                        return (
                            <div key={device.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                                {!isEditing ? (
                                    <div className="flex items-center gap-4">
                                        <img
                                            src={device.image_url || '/placeholder-device.png'}
                                            alt=""
                                            className="w-11 h-11 rounded-lg object-cover border shrink-0 bg-muted"
                                        />
                                        <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-xs">
                                            <div><span className="text-muted-foreground">รหัส:</span> <span className="font-semibold">{device.asset_tag}</span></div>
                                            <div className="truncate"><span className="text-muted-foreground">ชื่อ:</span> <span className="font-semibold">{device.name}</span></div>
                                            <div className="truncate"><span className="text-muted-foreground">ผู้ถือ:</span> {device.assigned_to || '-'}</div>
                                            <div className="truncate"><span className="text-muted-foreground">แผนก:</span> {device.department || '-'}</div>
                                            <div><span className="text-muted-foreground">ประเภท:</span> {device.category || '-'}</div>
                                            <div className="flex items-center gap-1.5"><span className="text-muted-foreground">สถานะ:</span> <StatusBadge status={device.status} /></div>
                                            <div><span className="text-muted-foreground">ซื้อ:</span> {device.purchase_date || '-'}</div>
                                            <div><span className="text-muted-foreground">ประกันหมด:</span> {device.warranty_expire || '-'}</div>
                                            <div><span className="text-muted-foreground">ราคา:</span> {formatPrice(device.purchase_price)} บาท</div>
                                            <div className="truncate"><span className="text-muted-foreground">สถานที่:</span> {device.installation_location || '-'}</div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => startEdit(device)}>
                                            <Pencil size={14} />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-4">
                                            <div className="flex flex-col items-center gap-1 shrink-0">
                                                <div className="scale-75 origin-top">
                                                    <ImageUploader imageUrl={editForm.image_url} onImageChange={handleImageChange} />
                                                </div>
                                            </div>

                                            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-bold text-foreground/70">รหัสอุปกรณ์</label>
                                                    <Input className="h-8 text-xs mt-0.5" value={editForm.asset_tag || ''} onChange={e => setEditForm(f => ({ ...f, asset_tag: e.target.value }))} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-foreground/70">ชื่ออุปกรณ์</label>
                                                    <Input className="h-8 text-xs mt-0.5" value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-foreground/70">ผู้ได้รับมอบหมาย</label>
                                                    <Input className="h-8 text-xs mt-0.5" value={editForm.assigned_to || ''} onChange={e => setEditForm(f => ({ ...f, assigned_to: e.target.value }))} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-foreground/70">ฝ่าย / แผนก</label>
                                                    <div className="mt-0.5">
                                                        <SearchSelect
                                                            value={editForm.department}
                                                            options={departments}
                                                            placeholder="ค้นหาแผนก"
                                                            onSelect={(v) => setEditForm(f => ({ ...f, department: v }))}
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-foreground/70">ประเภทอุปกรณ์</label>
                                                    <div className="mt-0.5">
                                                        <SearchSelect
                                                            value={editForm.category}
                                                            options={categories}
                                                            placeholder="ค้นหาประเภท"
                                                            onSelect={(v) => setEditForm(f => ({ ...f, category: v }))}
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-foreground/70">สถานะการใช้งาน</label>
                                                    <select
                                                        placeholder="สถานะ"
                                                        value={editForm.status || ''}
                                                        onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                                                        className="h-8 w-full text-xs rounded-md border px-2 mt-0.5"
                                                    >
                                                        <option value="" disabled>เลือกสถานะ</option>
                                                        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-foreground/70">วันที่ซื้ออุปกรณ์</label>
                                                    <Input type="date" className="h-8 text-xs mt-0.5 font-mono" value={editForm.purchase_date || ''} onChange={e => setEditForm(f => ({ ...f, purchase_date: e.target.value }))} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-foreground/70">วันหมดประกัน</label>
                                                    <Input type="date" className="h-8 text-xs mt-0.5 font-mono" value={editForm.warranty_expire || ''} onChange={e => setEditForm(f => ({ ...f, warranty_expire: e.target.value }))} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-foreground/70">ราคาที่ซื้อ (บาท)</label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        className="h-8 text-xs mt-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        value={editForm.purchase_price || ''}
                                                        placeholder="เช่น 25000"
                                                        onChange={e => setEditForm(f => ({ ...f, purchase_price: e.target.value }))}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-foreground/70">สถานที่ติดตั้ง</label>
                                                    <Input
                                                        className="h-8 text-xs mt-0.5"
                                                        value={editForm.installation_location || ''}
                                                        placeholder="เช่น ชั้น 3 ห้อง IT"
                                                        onChange={e => setEditForm(f => ({ ...f, installation_location: e.target.value }))}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-foreground/70">บริษัท</label>
                                                    <Input className="h-8 text-xs mt-0.5" value={editForm.company || ''} onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-foreground/70">เบอร์ผู้ติดต่อบริษัท</label>
                                                    <Input type="number" className="h-8 text-xs mt-0.5" value={editForm.company_contact || ''} onChange={e => setEditForm(f => ({ ...f, company_contact: e.target.value }))} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-2 border-t pt-3">
                                            <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving} className="gap-1">
                                                <X size={13} /> ยกเลิก
                                            </Button>
                                            <Button size="sm" onClick={handleSaveRow} disabled={saving} className="gap-1">
                                                <Check size={13} /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {filtered.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-10">ไม่พบอุปกรณ์ที่ค้นหา</p>
                    )}

                    {/* ✅ แถบแบ่งหน้า แสดงเฉพาะเมื่อมีมากกว่า 1 หน้า */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-1 py-2 border-t border-border pt-4 mt-2">
                            <p className="text-xs text-muted-foreground">
                                แสดง {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} จาก {filtered.length} รายการ
                            </p>

                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2.5"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                >
                                    <ChevronLeft size={14} />
                                </Button>

                                <span className="text-xs text-muted-foreground px-2">
                                    หน้า {currentPage} / {totalPages}
                                </span>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2.5"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                >
                                    <ChevronRight size={14} />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <ImageCropDialog
                isOpen={cropDialogOpen}
                setIsOpen={setCropDialogOpen}
                imageSrc={imageSrc}
                crop={crop}
                setCrop={setCrop}
                zoom={zoom}
                setZoom={setZoom}
                onCropComplete={(area, pixels) => setCroppedAreaPixels(pixels)}
                onSave={saveCrop}
            />
        </div>
    );
}