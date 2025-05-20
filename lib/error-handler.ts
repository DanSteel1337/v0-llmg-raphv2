/**
 * Error Handler
 *
 * Provides error handling utilities for API routes.
 * This file exists for backward compatibility.
 * New code should use utils/errorHandling.ts instead.
 */

import { withErrorHandling as withErrorHandlingUtil } from "@/utils/errorHandling"

/**
 * Higher-order function for handling errors in API routes
 */
export const withErrorHandling = withErrorHandlingUtil
