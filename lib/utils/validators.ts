/**
 * Validators
 *
 * Utility functions for validating data structures
 */

import type { Document } from "@/types"

/**
 * Validates if an object is a valid Document
 *
 * @param doc Any object to validate
 * @returns Type guard for Document
 */
export function isValidDocument(doc: any): doc is Document {
  return (
    !!doc?.id &&
    typeof doc.id === "string" &&
    doc.id.length > 5 &&
    typeof doc.file_path === "string" &&
    doc.file_path.length > 0
  )
}
