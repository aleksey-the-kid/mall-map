import { ref, computed, onMounted } from 'vue'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

export function useAuth() {
  const user = ref(null)
  const loading = ref(isSupabaseConfigured)
  const error = ref(null)

  async function init() {
    if (!supabase) {
      loading.value = false
      return
    }
    try {
      const { data } = await supabase.auth.getSession()
      user.value = data.session?.user ?? null
      supabase.auth.onAuthStateChange((_event, session) => {
        user.value = session?.user ?? null
      })
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function signIn(email, password) {
    if (!supabase) throw new Error('Supabase is not configured')
    error.value = null
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) throw err
    user.value = data.user
    return data.user
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    user.value = null
  }

  const isAuthenticated = computed(() => Boolean(user.value))
  const requiresAuth = computed(() => isSupabaseConfigured)

  onMounted(init)

  return {
    user,
    loading,
    error,
    isAuthenticated,
    requiresAuth,
    signIn,
    signOut,
    init,
  }
}
