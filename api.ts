/**
 * API Functions
 *
 * This file re-exports API functions from the client-api-service for easier imports.
 *
 * @module api
 */

import { uploadDocument } from "@/services/client-api-service"

// Re-export the uploadDocument function as apiUploadDocument
export const apiUploadDocument = uploadDocument
