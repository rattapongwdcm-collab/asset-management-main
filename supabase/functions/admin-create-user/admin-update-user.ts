import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ข้อความ error จาก GoTrue ที่ถือเป็น "validation error" (ความผิดพลาดจากผู้ใช้ ไม่ใช่ bug ฝั่งเรา)
// ควรตอบกลับเป็น 400 ไม่ใช่ 500
const isValidationError = (message = "") => {
  const m = message.toLowerCase();
  return (
    m.includes("different from the old password") ||
    m.includes("should be at least") ||
    m.includes("password") && m.includes("weak")
  );
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // client ที่ใช้ token ของผู้เรียก เพื่อตรวจว่าคนเรียกเป็น admin จริง
    const authHeader = req.headers.get("Authorization")!;
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callerUser }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !callerUser) {
      return new Response(JSON.stringify({ error: "ไม่ได้รับอนุญาต" }), { status: 401, headers: corsHeaders });
    }

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .single();

    if (callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "เฉพาะ Admin เท่านั้นที่เปลี่ยนรหัสผ่านผู้อื่นได้" }), { status: 403, headers: corsHeaders });
    }

    const { user_id, password } = await req.json();

    if (!user_id || !password || password.length < 5) {
      return new Response(JSON.stringify({ error: "กรุณาระบุ user_id และรหัสผ่านที่ยาวอย่างน้อย 5 ตัว" }), { status: 400, headers: corsHeaders });
    }

    // client แบบ admin (service role) — ใช้แค่ในฟังก์ชันนี้ ไม่เคยส่งออกไป frontend
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: updateErr } = await adminClient.auth.admin.updateUserById(user_id, { password });
    if (updateErr) {
      // ความผิดพลาดที่เกิดจากตัวรหัสผ่านเอง (เช่นซ้ำของเดิม) ถือเป็น 400 ไม่ใช่ 500
      const status = isValidationError(updateErr.message) ? 400 : 500;
      return new Response(JSON.stringify({ error: updateErr.message }), { status, headers: corsHeaders });
    }

    // ลบ session/refresh token เก่าทั้งหมดของ user นี้ เพื่อบังคับให้ล็อกอินใหม่ทุกอุปกรณ์
    const { error: revokeErr } = await adminClient.rpc("revoke_user_sessions", {
      target_user_id: user_id,
    });
    if (revokeErr) {
      // ไม่ throw เพื่อไม่ให้ทำให้ทั้ง request fail ถ้าการเปลี่ยนรหัสผ่านสำเร็จแล้ว
      console.error("revoke_user_sessions error:", revokeErr);
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (err) {
    console.error("admin-update-user error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});