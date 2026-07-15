import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
      return new Response(JSON.stringify({ error: "เฉพาะ Admin เท่านั้นที่ลบบัญชีได้" }), { status: 403, headers: corsHeaders });
    }

    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "กรุณาระบุ user_id" }), { status: 400, headers: corsHeaders });
    }

    // กันไม่ให้แอดมินลบบัญชีตัวเอง
    if (user_id === callerUser.id) {
      return new Response(JSON.stringify({ error: "ไม่สามารถลบบัญชีของตัวเองได้" }), { status: 400, headers: corsHeaders });
    }

    // client แบบ admin (service role) — ใช้แค่ในฟังก์ชันนี้ ไม่เคยส่งออกไป frontend
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ลบ profile ก่อน เพราะถ้า profiles.id มี foreign key อ้างอิงไปที่ auth.users(id)
    // แบบไม่ใช่ cascade การลบ auth.users ก่อนจะชน constraint แล้ว error ทันที
    const { error: profileDeleteErr } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", user_id);
    if (profileDeleteErr) throw profileDeleteErr;

    // จากนั้นค่อยลบบัญชีจริงจาก auth.users
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user_id);
    if (deleteErr) throw deleteErr;

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});