import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Search, Shield, ShieldCheck, User as UserIcon, Pencil } from 'lucide-react';

// ── ค่าคงที่ (Constants) ────────────────────────────────────────────────
const MIN_PASSWORD_LENGTH = 5;

const ROLE_BADGE = {
    admin: { label: 'Admin', bg: '#FEE2E2', color: '#B91C1C' },
    user: { label: 'User', bg: '#E0F2FE', color: '#0369A1' },
};

const EMPTY_ADD_FORM = { email: '', password: '', full_name: '', role: 'user' };

// ── Helper Components ───────────────────────────────────────────────────

/** ช่อง Select เลือก role ใช้ซ้ำได้ทั้งใน Dialog เพิ่มบัญชี และ Dialog แก้ไขสิทธิ์ */
function RoleSelect({ value, onChange }) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-10 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
        </Select>
    );
}

/** ป้าย role สีๆ (Admin / User) */
function RoleBadge({ role }) {
    const badge = ROLE_BADGE[role] || ROLE_BADGE.user;
    return (
        <span
            className="text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap"
            style={{ backgroundColor: badge.bg, color: badge.color }}
        >
            {badge.label}
        </span>
    );
}

// ── Main Component ───────────────────────────────────────────────────────
export default function AdminAccounts() {
    // รายชื่อบัญชีทั้งหมด + สถานะโหลด + ค้นหา
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Dialog เพิ่มบัญชี
    const [addOpen, setAddOpen] = useState(false);
    const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
    const [addSaving, setAddSaving] = useState(false);
    const [addError, setAddError] = useState('');

    // Dialog แก้ไขสิทธิ์ (role)
    const [editItem, setEditItem] = useState(null);
    const [editRole, setEditRole] = useState('user');
    const [editSaving, setEditSaving] = useState(false);

    // ── โหลดข้อมูลบัญชีจาก Supabase ────────────────────────────────────
    const load = async () => {
        setLoading(true);
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        setProfiles(data || []);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    // ── ค้นหา ────────────────────────────────────────────────────────
    const filtered = profiles.filter((p) => {
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return (p.email || '').toLowerCase().includes(q) || (p.full_name || '').toLowerCase().includes(q);
    });

    /** ตัวช่วยอัปเดตฟิลด์เดียวใน addForm เพื่อลดการเขียน setAddForm ซ้ำในทุก input */
    const updateAddForm = (key) => (e) => {
        const value = e?.target ? e.target.value : e;
        setAddForm((f) => ({ ...f, [key]: value }));
    };

    // ── เพิ่มบัญชีผู้ใช้ใหม่ ────────────────────────────────────────────
    const handleAdd = async () => {
        setAddError('');
        if (!addForm.email.trim() || !addForm.password) {
            setAddError('กรุณากรอกอีเมลและรหัสผ่าน');
            return;
        }
        if (addForm.password.length < MIN_PASSWORD_LENGTH) {
            setAddError(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
            return;
        }

        setAddSaving(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const { data, error } = await supabase.functions.invoke('admin-create-user', {
                body: addForm,
                headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            setAddOpen(false);
            setAddForm(EMPTY_ADD_FORM);
            await load();
        } catch (err) {
            setAddError(err.message || 'สร้างบัญชีไม่สำเร็จ');
        } finally {
            setAddSaving(false);
        }
    };

    // ── แก้ไขสิทธิ์ (role) ของบัญชี ─────────────────────────────────────
    const openEdit = (profile) => {
        setEditItem(profile);
        setEditRole(profile.role);
    };

    const handleEditSave = async () => {
        if (!editItem) return;
        setEditSaving(true);
        try {
            const { error } = await supabase.from('profiles').update({ role: editRole }).eq('id', editItem.id);
            if (error) throw error;
            setEditItem(null);
            await load();
        } catch (err) {
            alert('บันทึกไม่สำเร็จ: ' + err.message);
        } finally {
            setEditSaving(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────
    return (
        // max-w กันไม่ให้เนื้อหายืดกว้างเกินไปบนจอใหญ่ (24"/27"+) และ mx-auto จัดกึ่งกลาง
        <div className="max-w-[1200px] mx-auto w-full space-y-5 px-1 sm:px-2">
            {/* หัวข้อหน้า + ปุ่มเพิ่มบัญชี: ซ้อนกันแนวตั้งบนมือถือ, แนวนอนบนจอกว้าง */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground font-heading flex items-center gap-2">
                    <ShieldCheck className="text-primary shrink-0" size={22} />
                    จัดการบัญชีผู้ใช้ (Admin)
                </h2>
                <Button onClick={() => setAddOpen(true)} className="gap-2 w-full sm:w-auto">
                    <UserPlus size={16} /> เพิ่มบัญชี
                </Button>
            </div>

            {/* ช่องค้นหา */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="ค้นหาอีเมล, ชื่อ..."
                        className="pl-9 h-10 w-full"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {filtered.map((p) => (
                        <div
                            key={p.id}
                            className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                        >
                            <div className="min-w-0 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                                    {p.role === 'admin' ? <Shield size={16} /> : <UserIcon size={16} />}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm truncate">{p.full_name || '(ไม่มีชื่อ)'}</p>
                                    <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                <RoleBadge role={p.role} />
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                                    <Pencil size={14} />
                                </Button>
                            </div>
                        </div>
                    ))}

                    {filtered.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-10">ไม่พบบัญชีที่ค้นหา</p>
                    )}
                </div>
            )}

            {/* Dialog เพิ่มบัญชี */}
            <Dialog open={addOpen} onOpenChange={(open) => !addSaving && setAddOpen(open)}>
                <DialogContent className="w-[92vw] max-w-sm sm:max-w-md rounded-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><UserPlus size={16} /> เพิ่มบัญชีผู้ใช้</DialogTitle>
                    </DialogHeader>

                    {addError && (
                        <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">{addError}</div>
                    )}

                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs">อีเมล</Label>
                            <Input type="email" value={addForm.email} onChange={updateAddForm('email')} className="h-10 mt-1" />
                        </div>
                        <div>
                            <Label className="text-xs">รหัสผ่าน (อย่างน้อย {MIN_PASSWORD_LENGTH} ตัวอักษร)</Label>
                            <Input type="password" value={addForm.password} onChange={updateAddForm('password')} className="h-10 mt-1" />
                        </div>
                        <div>
                            <Label className="text-xs">ชื่อ-นามสกุล</Label>
                            <Input value={addForm.full_name} onChange={updateAddForm('full_name')} className="h-10 mt-1" />
                        </div>
                        <div>
                            <Label className="text-xs">Role</Label>
                            <RoleSelect value={addForm.role} onChange={(v) => updateAddForm('role')(v)} />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-end gap-2 mt-2">
                        <Button className="text-xs hover:bg-[#111827] hover:text-white" variant="outline" onClick={() => setAddOpen(false)} disabled={addSaving}>
                            ยกเลิก
                        </Button>
                        <Button className="text-xs hover:bg-[#111827] hover:text-white" variant="outline" onClick={handleAdd} disabled={addSaving}>
                            {addSaving ? 'กำลังสร้าง...' : 'สร้างบัญชี'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog แก้ไข role */}
            <Dialog open={!!editItem} onOpenChange={(open) => !editSaving && !open && setEditItem(null)}>
                <DialogContent className="w-[92vw] max-w-sm sm:max-w-md rounded-lg">
                    <DialogHeader>
                        <DialogTitle>แก้ไขสิทธิ์ผู้ใช้</DialogTitle>
                    </DialogHeader>

                    <div className="text-xs text-muted-foreground mb-2 truncate">{editItem?.email}</div>

                    <div>
                        <Label className="text-xs">Role</Label>
                        <RoleSelect value={editRole} onChange={setEditRole} />
                    </div>

                    <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setEditItem(null)} disabled={editSaving}>ยกเลิก</Button>
                        <Button onClick={handleEditSave} disabled={editSaving}>
                            {editSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}