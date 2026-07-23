import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Search, Shield, ShieldCheck, User as UserIcon, UserX, Pencil, Trash2, KeyRound, TriangleAlert } from 'lucide-react';
import { ROLES, useUserRole } from '../hooks/use-user-role';

// ── ค่าคงที่ (Constants) ────────────────────────────────────────────────
const MIN_PASSWORD_LENGTH = 5;

const ROLE_BADGE = {
    admin: { label: 'Admin', bg: '#FEE2E2', color: '#B91C1C' },
    user: { label: 'User', bg: '#E0F2FE', color: '#0369A1' },
    guest: { label: 'Guest', bg: '#F1F5F9', color: '#475569' },
};

const EMPTY_ADD_FORM = { email: '', password: '', full_name: '', role: ROLES.USER };

// ข้อความ error จาก Supabase ที่บ่งบอกว่ารหัสผ่านใหม่ซ้ำกับรหัสผ่านเดิม
// (GoTrue จะตอบกลับมาเป็นข้อความทำนองนี้เมื่อรหัสผ่านใหม่เหมือนรหัสผ่านเดิม)
const isSamePasswordError = (message = '') => {
    const m = message.toLowerCase();
    return (
        m.includes('different from the old password') ||
        m.includes('should be different') ||
        m.includes('same password') ||
        m.includes('same as the old')
    );
};

// ── Helper Components ───────────────────────────────────────────────────

/** ช่อง Select เลือก role ใช้ซ้ำได้ทั้งใน Dialog เพิ่มบัญชี และ Dialog แก้ไขสิทธิ์ */
function RoleSelect({ value, onChange, disabled }) {
    return (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className="h-10 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
            </SelectContent>
        </Select>
    );
}

/** ป้าย role สีๆ (Admin / User / Guest) */
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
    // ── สิทธิ์ของผู้ใช้ปัจจุบัน — หน้านี้สำหรับแอดมินเท่านั้น ──
    const { isAdmin, loading: roleLoading } = useUserRole();

    // รายชื่อบัญชีทั้งหมด + สถานะโหลด + ค้นหา
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // id ของแอดมินที่ล็อกอินอยู่ตอนนี้ ใช้กันไม่ให้ลบบัญชีตัวเอง
    const [currentUserId, setCurrentUserId] = useState(null);

    // Dialog เพิ่มบัญชี
    const [addOpen, setAddOpen] = useState(false);
    const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
    const [addSaving, setAddSaving] = useState(false);
    const [addError, setAddError] = useState('');

    // Dialog แก้ไขสิทธิ์ (role) + เปลี่ยนรหัสผ่าน
    const [editItem, setEditItem] = useState(null);
    const [editRole, setEditRole] = useState(ROLES.USER);
    const [editPassword, setEditPassword] = useState('');
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState('');

    // Dialog ลบบัญชี
    const [deleteItem, setDeleteItem] = useState(null);
    const [deleteSaving, setDeleteSaving] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    // ── โหลดข้อมูลบัญชีจาก Supabase ────────────────────────────────────
    const load = async () => {
        setLoading(true);
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        setProfiles(data || []);
        setLoading(false);
    };

    useEffect(() => {
        load();
        // เก็บ id ของผู้ใช้ที่ล็อกอินอยู่ไว้เทียบตอนจะลบบัญชี
        supabase.auth.getUser().then(({ data }) => {
            setCurrentUserId(data?.user?.id ?? null);
        });
    }, []);

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

    /** helper: เรียก edge function พร้อมแนบ auth token ของแอดมินที่ล็อกอินอยู่ */
    const invokeAdminFn = async (fnName, body) => {
        let { data: sessionData, error: sessionErr } = await supabase.auth.getSession();

        // ถ้าไม่มี session (token หมดอายุ/ยังโหลดไม่เสร็จ) ให้ลอง refresh อีกครั้งก่อนยอมแพ้
        if (sessionErr || !sessionData?.session) {
            const refreshed = await supabase.auth.refreshSession();
            sessionData = refreshed.data;
            sessionErr = refreshed.error;
        }

        const accessToken = sessionData?.session?.access_token;
        if (sessionErr || !accessToken) {
            throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
        }

        const { data, error } = await supabase.functions.invoke(fnName, {
            body,
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (error) {
            // เมื่อ Edge Function ตอบกลับด้วย status ที่ไม่ใช่ 2xx, supabase-js จะโยน FunctionsHttpError
            // ที่มีแค่ข้อความทั่วไป ("Edge Function returned a non-2xx status code") โดยไม่ดึง body จริงมาให้
            // ต้องอ่าน error.context (Response object) เองเพื่อเอาข้อความ error จริงจาก backend
            let message = error.message;
            if (error.context && typeof error.context.json === 'function') {
                try {
                    const body = await error.context.clone().json();
                    if (body?.error) message = body.error;
                } catch (_) {
                    // อ่าน body ไม่ได้ (เช่นไม่ใช่ JSON) ก็ใช้ข้อความเดิมต่อไป
                }
            }
            throw new Error(message);
        }

        if (data?.error) throw new Error(data.error);
        return data;
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
            await invokeAdminFn('admin-create-user', addForm);
            setAddOpen(false);
            setAddForm(EMPTY_ADD_FORM);
            await load();
        } catch (err) {
            setAddError(err.message || 'สร้างบัญชีไม่สำเร็จ');
        } finally {
            setAddSaving(false);
        }
    };

    // ── แก้ไขสิทธิ์ (role) และ/หรือรหัสผ่านของบัญชี ─────────────────────
    const openEdit = (profile) => {
        // เอาโฟกัสออกจาก element ที่โฟกัสค้างอยู่ก่อนหน้า (เช่นช่องค้นหา ซึ่งบนมือถือ
        // อาจเปิดคีย์บอร์ดค้างอยู่ด้วย) ก่อนเปิด dialog กันไม่ให้ browser ปิดคีย์บอร์ด/
        // resize viewport พร้อมกับตอน dialog เข้ามาแย่งโฟกัสจนดูเหมือนจอ "เด้ง" กลับไปช่องค้นหา
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        setEditItem(profile);
        setEditRole(profile.role);
        setEditPassword('');
        setEditError('');
    };

    const handleEditSave = async () => {
        if (!editItem) return;
        setEditError('');

        // ตรวจรหัสผ่านใหม่ (ถ้ามีการกรอก) ก่อนบันทึก
        if (editPassword && editPassword.length < MIN_PASSWORD_LENGTH) {
            setEditError(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
            return;
        }

        setEditSaving(true);
        try {
            // 1) อัปเดต role ตรงในตาราง profiles ได้เลย (ยกเว้นบัญชีตัวเอง กันไว้อีกชั้น)
            if (editRole !== editItem.role && editItem.id !== currentUserId) {
                const { error } = await supabase.from('profiles').update({ role: editRole }).eq('id', editItem.id);
                if (error) throw error;
            }

            // 2) ถ้ามีการกรอกรหัสผ่านใหม่ ให้ยิงไป edge function เพื่อเปลี่ยนรหัสผ่าน
            //    (ต้องใช้สิทธิ์ admin ฝั่ง server เพราะเป็นการเปลี่ยนรหัสผ่านของ "ผู้ใช้คนอื่น")
            if (editPassword) {
                try {
                    await invokeAdminFn('admin-update-user', {
                        user_id: editItem.id,
                        password: editPassword,
                    });
                } catch (pwErr) {
                    // แยก error ของขั้นตอนเปลี่ยนรหัสผ่านออกมาโดยเฉพาะ เพื่อแจ้งเตือนกรณีรหัสผ่านซ้ำของเดิม
                    if (isSamePasswordError(pwErr.message)) {
                        throw new Error('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม กรุณาตั้งรหัสผ่านอื่น');
                    }
                    throw pwErr;
                }

                // ถ้าเปลี่ยนรหัสผ่านของ "ตัวเอง" ให้ออกจากระบบทันที เพราะ session ปัจจุบัน
                // ควรถูกตัดทิ้งและบังคับให้ล็อกอินใหม่ด้วยรหัสผ่านใหม่
                if (editItem.id === currentUserId) {
                    setEditItem(null);
                    alert('เปลี่ยนรหัสผ่านสำเร็จ ระบบจะออกจากระบบเพื่อให้เข้าสู่ระบบใหม่ด้วยรหัสผ่านใหม่');
                    await supabase.auth.signOut();
                    window.location.reload();
                    return;
                }
            }

            setEditItem(null);
            await load();
        } catch (err) {
            setEditError(err.message || 'บันทึกไม่สำเร็จ');
        } finally {
            setEditSaving(false);
        }
    };

    // ── ลบบัญชีผู้ใช้ ────────────────────────────────────────────────
    const openDelete = (profile) => {
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        setDeleteItem(profile);
        // แจ้งเตือนทันทีถ้าเลือกลบบัญชีของตัวเอง (ยังเปิด dialog ไว้ให้เห็นคำเตือน แต่ปุ่มลบจะถูกปิด)
        setDeleteError(profile.id === currentUserId ? 'คุณไม่สามารถลบบัญชีของตัวเองได้' : '');
    };

    const handleDelete = async () => {
        if (!deleteItem) return;

        // กันไว้อีกชั้น (defense in depth) เผื่อมีการเรียกใช้งานข้ามเส้นทางอื่น
        if (deleteItem.id === currentUserId) {
            setDeleteError('คุณไม่สามารถลบบัญชีของตัวเองได้');
            return;
        }

        setDeleteError('');
        setDeleteSaving(true);
        try {
            await invokeAdminFn('admin-delete-user', { user_id: deleteItem.id });
            setDeleteItem(null);
            await load();
        } catch (err) {
            setDeleteError(err.message || 'ลบบัญชีไม่สำเร็จ');
        } finally {
            setDeleteSaving(false);
        }
    };

    const isDeletingSelf = deleteItem?.id === currentUserId;

    // ── Guard: หน้านี้สำหรับแอดมินเท่านั้น ──────────────────────────
    if (roleLoading) {
        return (
            <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="max-w-[1200px] mx-auto w-full text-center py-16 text-muted-foreground">
                หน้านี้สำหรับแอดมินเท่านั้น
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────
    return (
        // max-w กันไม่ให้เนื้อหายืดกว้างเกินไปบนจอใหญ่ (24"/27"+) และ mx-auto จัดกึ่งกลาง
        <div className="max-w-[1200px] mx-auto w-full space-y-5 px-1 sm:px-2">
            {/* หัวข้อหน้า + ปุ่มเพิ่มบัญชี: ซ้อนกันแนวตั้งบนมือถือ, แนวนอนบนจอกว้าง */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground font-heading flex items-center gap-2">
                    <ShieldCheck className="text-primary shrink-0" size={22} />
                    จัดการบัญชีผู้ใช้ (ผู้ดูแลระบบ)
                </h2>
                <Button onClick={() => {
                    if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur();
                    }
                    setAddOpen(true);
                }} className="gap-2 w-full sm:w-auto">
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
                        name="admin-account-search"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        data-lpignore="true"
                        data-1p-ignore="true"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {filtered.map((p) => {
                        const isSelf = p.id === currentUserId;
                        return (
                            <div
                                key={p.id}
                                className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                            >
                                <div className="min-w-0 flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                                        {p.role === ROLES.ADMIN ? <Shield size={16} /> : p.role === ROLES.GUEST ? <UserX size={16} /> : <UserIcon size={16} />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-sm truncate flex items-center gap-1.5">
                                            {p.full_name || '(ไม่มีชื่อ)'}
                                            {isSelf && (
                                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                                                    คุณ
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                    <RoleBadge role={p.role} />
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)} title="แก้ไขสิทธิ์ / รหัสผ่าน">
                                        <Pencil size={14} />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={`h-8 w-8 ${isSelf
                                            ? 'text-muted-foreground disabled:opacity-40 hover:bg-transparent'
                                            : 'text-destructive hover:bg-destructive/10 hover:text-destructive'
                                            }`}
                                        onClick={() => openDelete(p)}
                                        disabled={isSelf}
                                        title={isSelf ? 'ไม่สามารถลบบัญชีของตัวเองได้' : 'ลบบัญชี'}
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}

                    {filtered.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-10">ไม่พบบัญชีที่ค้นหา</p>
                    )}
                </div>
            )}

            {/* Dialog เพิ่มบัญชี */}
            <Dialog open={addOpen} onOpenChange={(open) => !addSaving && setAddOpen(open)}>
                <DialogContent className="w-[92vw] max-w-sm sm:max-w-md rounded-lg max-h-[85vh] overflow-y-auto">
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
                            <Input
                                type="text"
                                value={addForm.password}
                                onChange={updateAddForm('password')}
                                className="h-10 mt-1"
                                style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                                autoComplete="off"
                                name="new-account-password-field"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck="false"
                                data-lpignore="true"
                                data-1p-ignore="true"
                            />
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

            {/* Dialog แก้ไข role + รหัสผ่าน */}
            <Dialog open={!!editItem} onOpenChange={(open) => !editSaving && !open && setEditItem(null)}>
                <DialogContent className="w-[92vw] max-w-sm sm:max-w-md rounded-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Pencil size={16} /> แก้ไขบัญชีผู้ใช้</DialogTitle>
                    </DialogHeader>

                    <div className="text-xs text-muted-foreground mb-2 truncate">{editItem?.email}</div>

                    {editError && (
                        <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs mb-2">{editError}</div>
                    )}

                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs">Role</Label>
                            <RoleSelect
                                value={editRole}
                                onChange={setEditRole}
                                disabled={editItem?.id === currentUserId}
                            />
                            {editItem?.id === currentUserId && (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    ไม่สามารถเปลี่ยน Role ของบัญชีตัวเองได้ เพื่อป้องกันการลดสิทธิ์ตัวเองโดยไม่ตั้งใจ
                                </p>
                            )}
                        </div>

                        <div>
                            <Label className="text-xs flex items-center gap-1">
                                <KeyRound size={12} /> ตั้งรหัสผ่านใหม่ (เว้นว่างไว้หากไม่ต้องการเปลี่ยน)
                            </Label>
                            <Input
                                type="text"
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                placeholder={`อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`}
                                className="h-10 mt-1"
                                style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                                autoComplete="off"
                                name="reset-password-field"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck="false"
                                data-lpignore="true"
                                data-1p-ignore="true"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
                        <Button className="text-xs hover:bg-[#111827] hover:text-white" variant="outline" onClick={() => setEditItem(null)} disabled={editSaving}>ยกเลิก</Button>
                        <Button className="text-xs hover:bg-[#111827] hover:text-white" variant="outline" onClick={handleEditSave} disabled={editSaving}>
                            {editSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog ยืนยันลบบัญชี */}
            <Dialog open={!!deleteItem} onOpenChange={(open) => !deleteSaving && !open && setDeleteItem(null)}>
                <DialogContent className="w-[92vw] max-w-sm sm:max-w-md rounded-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Trash2 size={16} /> ยืนยันการลบบัญชี
                        </DialogTitle>
                    </DialogHeader>

                    {deleteError && (
                        <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs flex items-start gap-1.5">
                            <TriangleAlert size={14} className="shrink-0 mt-0.5" />
                            <span>{deleteError}</span>
                        </div>
                    )}

                    {!isDeletingSelf && (
                        <p className="text-sm text-muted-foreground">
                            คุณต้องการลบบัญชี{' '}
                            <span className="font-semibold text-foreground">
                                {deleteItem?.full_name || deleteItem?.email}
                            </span>{' '}
                            ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
                        </p>
                    )}

                    <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
                        <Button className="text-xs hover:bg-[#111827] hover:text-white" variant="outline" onClick={() => setDeleteItem(null)} disabled={deleteSaving}>
                            ยกเลิก
                        </Button>
                        <Button
                            className="text-xs hover:bg-[#111827] hover:text-white" variant="outline"
                            onClick={handleDelete}
                            disabled={deleteSaving || isDeletingSelf}
                        >
                            {deleteSaving ? 'กำลังลบ...' : 'ลบบัญชี'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}