/**
 * User Hook
 *
 * React hook for accessing user information.
 * This is a wrapper around the useAuth hook to maintain naming consistency.
 *
 * @module hooks/useUser
 */

"use client"

import { useAuth } from "./use-auth"

/**
 * Hook for accessing user information
 * @returns User information and authentication state
 */
export function useUser() {
  return useAuth()
}
