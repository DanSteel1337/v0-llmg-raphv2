/**
 * User Hook
 *
 * Provides access to the current user information.
 * Re-exports useAuth hook with a different name for backward compatibility.
 */

import { useAuth } from "@/hooks/use-auth"

// Re-export with alternative name for backward compatibility
export const useUser = useAuth
