/**
 * Validation utilities for API requests
 */

import { logger } from "@/lib/utils/logger"

/**
 * Custom error for validation failures
 */
export class ValidationError extends Error {
  statusCode: number

  constructor(message: string) {
    super(message)
    this.name = "ValidationError"
    this.statusCode = 400
  }
}

/**
 * Validates that all required fields are present in an object
 * @param obj - The object to validate
 * @param fields - Array of required field names
 * @param context - Optional context name for error messages
 * @throws ValidationError if any required field is missing
 */
export const validateRequiredFields = <T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[],
  context = "Request",
): void => {
  const missingFields = fields.filter((field) => {
    const value = obj[field]
    return value === undefined || value === null || value === ""
  })

  if (missingFields.length > 0) {
    const errorMessage = `${context} missing required fields: ${missingFields.join(", ")}`
    logger.warn(errorMessage)
    throw new ValidationError(errorMessage)
  }
}
