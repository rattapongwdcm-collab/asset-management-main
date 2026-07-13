import { supabase } from '@/lib/supabase';

export async function logDeviceHistory({ deviceId, assetTag, deviceName, action, description, performedBy }) {
  try {
    const { error } = await supabase.from('device_history').insert([{
      device_id: deviceId,
      asset_tag: assetTag || null,
      device_name: deviceName || null,
      action,
      description: description || null,
      performed_by: performedBy || null,
    }]);
    if (error) console.error('บันทึกประวัติไม่สำเร็จ:', error.message);
  } catch (err) {
    console.error('บันทึกประวัติไม่สำเร็จ:', err.message);
  }
}