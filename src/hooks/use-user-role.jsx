// src/hook/use-user-role.jsx
import * as React from "react"
import { supabase } from "@/lib/supabase"

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest',
}

export function useUserRole() {
  const [role, setRole] = React.useState(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let active = true

    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) {
        if (active) { setRole(null); setLoading(false) }
        return
      }
      const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
      if (active) {
        setRole(data?.role || ROLES.USER)
        setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [])

  return {
    role,
    loading,
    isAdmin: role === ROLES.ADMIN,
    isUser: role === ROLES.USER,
    isGuest: role === ROLES.GUEST,
  }
}