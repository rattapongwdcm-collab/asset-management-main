import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Pencil } from 'lucide-react';
import { useState } from 'react';

export default function EditAction({ device, onEditRequest }) {
  // สถานะ 'รออนุมัติแก้ไข'
  const isPending = device.status === 'รออนุมัติแก้ไข';

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      disabled={isPending}
      onClick={() => onEditRequest(device)}
    >
      <Pencil 
        size={14} 
        className={isPending ? 'opacity-30 cursor-not-allowed' : 'text-foreground/70'} 
      />
    </Button>
  );
}