import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'

// Usuario único de la app en Supabase Auth. La base (RLS) solo deja pasar a este usuario.
const APP_EMAIL = 'organizacion@lachacra.app'
// Supabase pide contraseñas de 6+ caracteres: lo que se escribe en pantalla (ej. 1928)
// se manda como "organizacion-1928".
const toAuthPassword = (pwd: string) => `organizacion-${pwd}`

interface AuthContextValue {
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  login: (password: string) => Promise<boolean>
  logout: () => void
  changePassword: (oldPwd: string, newPwd: string) => Promise<{ ok: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    localStorage.removeItem('alimentos_session') // marca del login viejo, ya no se usa
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(!!data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function login(password: string): Promise<boolean> {
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: APP_EMAIL,
      password: toAuthPassword(password),
    })
    if (authError) {
      const msg = (authError.message || '').toLowerCase()
      setError(
        msg.includes('invalid') || msg.includes('credentials')
          ? 'Contraseña incorrecta.'
          : 'No se pudo verificar la contraseña. Revisá la conexión con Supabase.'
      )
      return false
    }
    setIsAuthenticated(true)
    return true
  }

  function logout() {
    supabase.auth.signOut()
    setIsAuthenticated(false)
  }

  async function changePassword(oldPwd: string, newPwd: string) {
    // Verifica la contraseña actual volviendo a iniciar sesión con ella
    const { error: checkError } = await supabase.auth.signInWithPassword({
      email: APP_EMAIL,
      password: toAuthPassword(oldPwd),
    })
    if (checkError) {
      const msg = (checkError.message || '').toLowerCase()
      if (msg.includes('invalid') || msg.includes('credentials')) {
        return { ok: false, error: 'La contraseña actual no es correcta.' }
      }
      return { ok: false, error: 'Error de conexión con Supabase.' }
    }
    const { error: updError } = await supabase.auth.updateUser({ password: toAuthPassword(newPwd) })
    if (updError) {
      return { ok: false, error: 'No se pudo cambiar la contraseña. Probá con otra (y que no sea igual a la actual).' }
    }
    return { ok: true }
  }

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, loading, error, login, logout, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
