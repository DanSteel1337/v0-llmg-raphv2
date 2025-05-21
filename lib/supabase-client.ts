/**
 * Supabase Client
 *
 * Streamlined Supabase client for authentication in the serverless RAG system.
 * Implements a singleton pattern with simplified error handling and session management.
 *
 * @module lib/supabase-client
 */

import { createClientComponentClient, createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { cache } from "react"
import { AuthenticationError, AuthorizationError, ServiceError, ValidationError, ErrorCode } from "@/types/errors"
import { clientLogger } from "@/utils/client-logger"
import type { IAppError } from "@/types/app-error" // Declare IAppError

import type { SupabaseClient, User, Session, AuthError } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

// Constants for authentication
const SESSION_EXPIRY_BUFFER = 5 * 60 * 1000 // 5 minutes in milliseconds
const MAX_AUTH_RETRIES = 3

// Type for JWT token payload
export interface JwtPayload {
  aud: string
  exp: number
  sub: string
  email?: string
  role?: string
  iat: number
}

// Type for authentication result
export interface AuthResult {
  user: User | null
  session: Session | null
  error: AuthError | null
}

// Singleton instances
const browserClient: SupabaseClient<Database> | null = null
let serverClient: SupabaseClient<Database> | null = null

/**
 * Creates a Supabase client for browser/client components
 * @deprecated Use createClientComponentClient() directly
 */
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  return createClientComponentClient<Database>()
}

/**
 * Creates a Supabase client for server components
 */
export const getSupabaseServerClient = cache((): SupabaseClient<Database> => {
  if (typeof window !== "undefined") {
    throw new Error("getSupabaseServerClient should not be called from browser")
  }

  if (!serverClient) {
    try {
      serverClient = createServerComponentClient<Database>({ cookies })
    } catch (error) {
      // Fallback to direct client creation if cookies are not available
      serverClient = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      )
    }
  }
  return serverClient
})

/**
 * Creates a Supabase client for API routes
 */
export function createApiRouteClient(cookieStore: any): SupabaseClient<Database> {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        cookie: cookieStore
          ? Object.entries(cookieStore)
              .map(([name, value]) => `${name}=${value}`)
              .join("; ")
          : "",
      },
    },
  })
}

/**
 * Gets the current authenticated user
 * @deprecated Use supabase.auth.getUser() directly
 */
export async function getUser(): Promise<any> {
  const supabase = createClientComponentClient<Database>()
  const { data } = await supabase.auth.getUser()
  return data?.user || null
}

/**
 * Signs in a user with email and password
 * @deprecated Use supabase.auth.signInWithPassword() directly
 */
export async function signIn(email: string, password: string): Promise<any> {
  const supabase = createClientComponentClient<Database>()
  return await supabase.auth.signInWithPassword({ email, password })
}

/**
 * Signs in a user with a magic link
 */
export async function signInWithMagicLink(
  email: string,
  redirectTo?: string,
  client?: SupabaseClient<Database>,
): Promise<boolean> {
  try {
    const supabase = client || getSupabaseBrowserClient()
    clientLogger.info("Magic link authentication attempt", {
      email: email.slice(0, 3) + "...",
      redirectTo,
    })

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    })

    if (error) {
      clientLogger.warn("Magic link authentication failed", {
        email: email.slice(0, 3) + "...",
        errorCode: error.status,
        errorMessage: error.message,
      })

      throw new AuthenticationError(`Failed to send magic link: ${error.message}`, {
        code: ErrorCode.MAGIC_LINK_FAILED,
        statusCode: 401,
        context: { originalError: error },
      })
    }

    clientLogger.info("Magic link sent successfully", {
      email: email.slice(0, 3) + "...",
    })

    return true
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error
    }
    throw new ServiceError(`Error sending magic link: ${error instanceof Error ? error.message : "Unknown error"}`, {
      code: ErrorCode.SERVICE_ERROR,
      statusCode: 500,
      context: { originalError: error },
    })
  }
}

/**
 * Signs out the current user
 * @deprecated Use supabase.auth.signOut() directly
 */
export async function signOut(): Promise<boolean> {
  const supabase = createClientComponentClient<Database>()
  const { error } = await supabase.auth.signOut()
  return !error
}

/**
 * Gets the current session
 */
export async function getSession(client?: SupabaseClient<Database>): Promise<Session | null> {
  try {
    const supabase = client || getSupabaseBrowserClient()
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      throw new AuthenticationError(`Failed to get session: ${error.message}`, {
        code: ErrorCode.SESSION_FETCH_FAILED,
        statusCode: 401,
        context: { originalError: error },
      })
    }

    return data?.session || null
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error
    }
    throw new ServiceError(`Error getting session: ${error instanceof Error ? error.message : "Unknown error"}`, {
      code: ErrorCode.SERVICE_ERROR,
      statusCode: 500,
      context: { originalError: error },
    })
  }
}

/**
 * Refreshes the current session with token rotation
 */
export async function refreshSession(client?: SupabaseClient<Database>): Promise<Session | null> {
  let retries = 0

  while (retries < MAX_AUTH_RETRIES) {
    try {
      const supabase = client || getSupabaseBrowserClient()
      clientLogger.info("Session refresh attempt", { attempt: retries + 1 })

      const { data, error } = await supabase.auth.refreshSession()

      if (error) {
        clientLogger.warn("Session refresh failed", {
          attempt: retries + 1,
          errorCode: error.status,
          errorMessage: error.message,
        })

        if (retries >= MAX_AUTH_RETRIES - 1) {
          throw new AuthenticationError(`Failed to refresh session: ${error.message}`, {
            code: ErrorCode.SESSION_REFRESH_FAILED,
            statusCode: 401,
            context: { originalError: error },
          })
        }

        retries++
        await new Promise((resolve) => setTimeout(resolve, 1000 * retries))
        continue
      }

      clientLogger.info("Session refresh successful", { attempt: retries + 1 })
      return data?.session || null
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error
      }

      if (retries >= MAX_AUTH_RETRIES - 1) {
        throw new ServiceError(
          `Error refreshing session: ${error instanceof Error ? error.message : "Unknown error"}`,
          {
            code: ErrorCode.SERVICE_ERROR,
            statusCode: 500,
            context: { originalError: error },
          },
        )
      }

      retries++
      await new Promise((resolve) => setTimeout(resolve, 1000 * retries))
    }
  }

  throw new ServiceError("Failed to refresh session after multiple attempts", {
    code: ErrorCode.SESSION_REFRESH_FAILED,
    statusCode: 500,
  })
}

/**
 * Sets up an auth state change listener
 */
export function onAuthStateChange(
  callback: (event: "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED" | "TOKEN_REFRESHED", session: Session | null) => void,
  client?: SupabaseClient<Database>,
): () => void {
  const supabase = client || getSupabaseBrowserClient()
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    clientLogger.info("Auth state changed", { event })
    callback(event, session)
  })

  return data.subscription.unsubscribe
}

/**
 * Gets the current JWT token
 * @deprecated Use supabase.auth.getSession() directly
 */
export async function getJwtToken(): Promise<string | null> {
  const supabase = createClientComponentClient<Database>()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

/**
 * Decodes and validates a JWT token
 */
export function decodeJwtToken(token: string): JwtPayload | null {
  try {
    const [, payloadBase64] = token.split(".")
    if (!payloadBase64) {
      return null
    }

    const payloadJson = atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(payloadJson) as JwtPayload
  } catch (error) {
    clientLogger.error("Error decoding JWT token", {
      error: error instanceof Error ? error.message : "Unknown error",
    })
    return null
  }
}

/**
 * Checks if a JWT token is still valid
 */
export function isTokenValid(token: string): boolean {
  try {
    const payload = decodeJwtToken(token)
    if (!payload) {
      return false
    }

    const now = Math.floor(Date.now() / 1000)
    return payload.exp > now + SESSION_EXPIRY_BUFFER / 1000
  } catch (error) {
    return false
  }
}

/**
 * Maps authentication errors to standardized error responses
 */
export function mapAuthError(error: AuthError): IAppError {
  switch (error.status) {
    case 400:
      return new ValidationError("Invalid authentication request", {
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 400,
        context: { originalError: error },
      })
    case 401:
      return new AuthenticationError("Invalid credentials", {
        code: ErrorCode.INVALID_CREDENTIALS,
        statusCode: 401,
        context: { originalError: error },
      })
    case 403:
      return new AuthorizationError("Insufficient permissions", {
        code: ErrorCode.INSUFFICIENT_PERMISSIONS,
        statusCode: 403,
        context: { originalError: error },
      })
    case 404:
      return new AuthenticationError("User not found", {
        code: ErrorCode.USER_NOT_FOUND,
        statusCode: 404,
        context: { originalError: error },
      })
    case 422:
      return new ValidationError("Validation error", {
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 422,
        context: { originalError: error },
      })
    case 429:
      return new AuthenticationError("Too many requests", {
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        statusCode: 429,
        context: { originalError: error },
      })
    default:
      return new AuthenticationError(error.message || "Authentication error", {
        code: ErrorCode.AUTH_ERROR,
        statusCode: error.status || 500,
        context: { originalError: error },
      })
  }
}

// Re-export createClient from supabase
export { createClient } from "@supabase/supabase-js"
