/**
 * API Module
 *
 * Centralizes API function exports for easier imports.
 * Re-exports functions from services/client-api-service.ts with alternative names
 * to maintain backward compatibility.
 */

import { uploadDocument } from "@/services/client-api-service"

// Re-export with alternative name for backward compatibility
export const apiUploadDocument = uploadDocument
