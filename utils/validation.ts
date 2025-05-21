/**
 * Validation Utilities
 *
 * Provides utility functions for validating data in the client-side of the application.
 * These functions use the core validators but are designed for client-side use cases.
 *
 * @module utils/validation
 */

import type React from "react"
import { ValidationError as BaseValidationError } from "./errorHandling"
import { ValidationMessages } from "@/constants/validation-messages"
import * as validators from "@/lib/utils/validators"

// Re-export ValidationError from errorHandling
export { ValidationError } from "./errorHandling"

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

/**
 * Validation constraint interface
 */
export interface ValidationConstraint {
  type?: string
  required?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: RegExp
  message?: string
  validator?: (value: any) => boolean | Promise<boolean>
  allowEmpty?: boolean
}

/**
 * Validation schema type
 */
export type ValidationSchema = Record<string, ValidationConstraint | ValidationConstraint[]>

/**
 * Validation context interface
 */
export interface ValidationContext {
  field: string
  value: any
  constraint: ValidationConstraint
}

/**
 * Formats an error message by replacing placeholders with values
 *
 * @param message - Message template with placeholders
 * @param values - Values to replace placeholders
 * @returns Formatted message
 */
export function formatErrorMessage(message: string, values: Record<string, any> = {}): string {
  return message.replace(/\{(\w+)\}/g, (_, key) => {
    return values[key] !== undefined ? String(values[key]) : `{${key}}`
  })
}

/**
 * Validates that required fields exist in an object
 *
 * @param obj - Object to validate
 * @param fields - Array of required field names
 * @param errorMessage - Custom error message
 * @throws ValidationError if any required field is missing
 */
export function validateRequiredFields(obj: Record<string, any>, fields: string[], errorMessage?: string): void {
  const missingFields = fields.filter((field) => {
    const value = obj[field]
    return value === undefined || value === null || value === ""
  })

  if (missingFields.length > 0) {
    const fieldErrors: Record<string, string> = {}
    missingFields.forEach((field) => {
      fieldErrors[field] = ValidationMessages.required
    })

    throw new BaseValidationError(errorMessage || `Missing required fields: ${missingFields.join(", ")}`, fieldErrors)
  }
}

/**
 * Validates value type
 *
 * @param value - Value to validate
 * @param expectedType - Expected type
 * @returns Whether the value is of the expected type
 */
export function validateType(value: any, expectedType: string): boolean {
  if (value === null || value === undefined) {
    return false
  }

  switch (expectedType.toLowerCase()) {
    case "string":
      return typeof value === "string"
    case "number":
      return typeof value === "number" && !isNaN(value)
    case "boolean":
      return typeof value === "boolean"
    case "object":
      return typeof value === "object" && !Array.isArray(value) && value !== null
    case "array":
      return Array.isArray(value)
    case "date":
      return value instanceof Date && !isNaN(value.getTime())
    default:
      return typeof value === expectedType
  }
}

/**
 * Validates string length
 *
 * @param value - String to validate
 * @param min - Minimum length
 * @param max - Maximum length
 * @returns Whether the string length is valid
 */
export function validateLength(value: string, min?: number, max?: number): boolean {
  if (typeof value !== "string") {
    return false
  }

  if (min !== undefined && value.length < min) {
    return false
  }

  if (max !== undefined && value.length > max) {
    return false
  }

  return true
}

/**
 * Validates string against regex pattern
 *
 * @param value - String to validate
 * @param pattern - Regex pattern
 * @returns Whether the string matches the pattern
 */
export function validatePattern(value: string, pattern: RegExp): boolean {
  if (typeof value !== "string") {
    return false
  }

  return pattern.test(value)
}

/**
 * Validates number range
 *
 * @param value - Number to validate
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Whether the number is within range
 */
export function validateRange(value: number, min?: number, max?: number): boolean {
  if (typeof value !== "number" || isNaN(value)) {
    return false
  }

  if (min !== undefined && value < min) {
    return false
  }

  if (max !== undefined && value > max) {
    return false
  }

  return true
}

/**
 * Validates email format
 *
 * @param email - Email to validate
 * @returns Whether the email format is valid
 */
export function validateEmail(email: string): boolean {
  return validators.isValidEmail(email)
}

/**
 * Validates URL format
 *
 * @param url - URL to validate
 * @returns Whether the URL format is valid
 */
export function validateUrl(url: string): boolean {
  return validators.isValidUrl(url)
}

/**
 * Validates date
 *
 * @param date - Date to validate
 * @returns Whether the date is valid
 */
export function validateDate(date: any): boolean {
  if (date instanceof Date) {
    return !isNaN(date.getTime())
  }

  if (typeof date === "string" || typeof date === "number") {
    const parsedDate = new Date(date)
    return !isNaN(parsedDate.getTime())
  }

  return false
}

/**
 * Validates document ID format
 *
 * @param id - Document ID to validate
 * @returns Whether the document ID format is valid
 */
export function validateDocumentId(id: string): boolean {
  return validators.isValidDocumentId(id)
}

/**
 * Validates file name format
 *
 * @param name - File name to validate
 * @returns Whether the file name format is valid
 */
export function validateFileName(name: string): boolean {
  return validators.isValidFileName(name)
}

/**
 * Validates file type
 *
 * @param type - File type to validate
 * @param allowedTypes - Array of allowed file types
 * @returns Whether the file type is allowed
 */
export function validateFileType(type: string, allowedTypes: string[] = ["text/plain"]): boolean {
  return validators.isValidFileType(type, allowedTypes)
}

/**
 * Validates file size
 *
 * @param size - File size in bytes
 * @param maxSize - Maximum allowed size in bytes
 * @returns Whether the file size is valid
 */
export function validateFileSize(size: number, maxSize: number = 10 * 1024 * 1024): boolean {
  return validators.isValidFileSize(size, maxSize)
}

/**
 * Validates user ID format
 *
 * @param id - User ID to validate
 * @returns Whether the user ID format is valid
 */
export function validateUserId(id: string): boolean {
  return validators.isValidUserId(id)
}

/**
 * Validates password complexity
 *
 * @param password - Password to validate
 * @param options - Validation options
 * @returns Whether the password meets complexity requirements
 */
export function validatePassword(
  password: string,
  options: {
    minLength?: number
    requireUppercase?: boolean
    requireLowercase?: boolean
    requireNumbers?: boolean
    requireSpecialChars?: boolean
  } = {},
): boolean {
  return validators.isValidPassword(password, options)
}

/**
 * Validates session token format
 *
 * @param token - Session token to validate
 * @returns Whether the session token format is valid
 */
export function validateSessionToken(token: string): boolean {
  return validators.isValidSessionToken(token)
}

/**
 * Validates API key format
 *
 * @param key - API key to validate
 * @returns Whether the API key format is valid
 */
export function validateApiKey(key: string): boolean {
  return validators.isValidApiKey(key)
}

/**
 * Validates form data against a schema
 *
 * @param formData - Form data to validate
 * @param schema - Validation schema
 * @returns Validation result with errors
 */
export function validateForm(formData: Record<string, any>, schema: ValidationSchema): ValidationResult {
  const errors: Record<string, string> = {}
  let valid = true

  for (const [field, constraints] of Object.entries(schema)) {
    const value = formData[field]
    const constraintArray = Array.isArray(constraints) ? constraints : [constraints]

    for (const constraint of constraintArray) {
      // Skip validation if field is not required and value is empty
      if (
        !constraint.required &&
        (value === undefined || value === null || value === "") &&
        constraint.allowEmpty !== false
      ) {
        continue
      }

      // Check required constraint
      if (constraint.required && (value === undefined || value === null || value === "")) {
        errors[field] = formatErrorMessage(constraint.message || ValidationMessages.required)
        valid = false
        break
      }

      // Skip further validation if value is empty
      if (value === undefined || value === null || value === "") {
        continue
      }

      // Check type constraint
      if (constraint.type && !validateType(value, constraint.type)) {
        errors[field] = formatErrorMessage(constraint.message || ValidationMessages.type, {
          type: constraint.type,
        })
        valid = false
        break
      }

      // Check minLength constraint
      if (constraint.minLength !== undefined && typeof value === "string" && value.length < constraint.minLength) {
        errors[field] = formatErrorMessage(constraint.message || ValidationMessages.minLength, {
          min: constraint.minLength,
        })
        valid = false
        break
      }

      // Check maxLength constraint
      if (constraint.maxLength !== undefined && typeof value === "string" && value.length > constraint.maxLength) {
        errors[field] = formatErrorMessage(constraint.message || ValidationMessages.maxLength, {
          max: constraint.maxLength,
        })
        valid = false
        break
      }

      // Check min constraint
      if (constraint.min !== undefined && typeof value === "number" && value < constraint.min) {
        errors[field] = formatErrorMessage(constraint.message || ValidationMessages.min, {
          min: constraint.min,
        })
        valid = false
        break
      }

      // Check max constraint
      if (constraint.max !== undefined && typeof value === "number" && value > constraint.max) {
        errors[field] = formatErrorMessage(constraint.message || ValidationMessages.max, {
          max: constraint.max,
        })
        valid = false
        break
      }

      // Check pattern constraint
      if (constraint.pattern && typeof value === "string" && !constraint.pattern.test(value)) {
        errors[field] = formatErrorMessage(constraint.message || ValidationMessages.pattern)
        valid = false
        break
      }

      // Check custom validator
      if (constraint.validator && !constraint.validator(value)) {
        errors[field] = formatErrorMessage(constraint.message || "Validation failed")
        valid = false
        break
      }
    }
  }

  return { valid, errors }
}

/**
 * Gets error for specific field
 *
 * @param errors - Errors object
 * @param field - Field name
 * @returns Error message for field
 */
export function getFieldError(errors: Record<string, string>, field: string): string | undefined {
  return errors[field]
}

/**
 * Validates input on blur event
 *
 * @param event - Blur event
 * @param validationFn - Validation function
 * @returns Whether the input is valid
 */
export function validateInputOnBlur(
  event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  validationFn: (value: string) => boolean,
): boolean {
  const value = event.target.value
  const isValid = validationFn(value)

  // Add or remove validation classes
  if (isValid) {
    event.target.classList.remove("invalid")
    event.target.classList.add("valid")
  } else {
    event.target.classList.remove("valid")
    event.target.classList.add("invalid")
  }

  return isValid
}

/**
 * Creates validation schema object
 *
 * @param fields - Fields configuration
 * @returns Validation schema
 */
export function createValidationSchema(fields: Record<string, ValidationConstraint>): ValidationSchema {
  return fields
}

/**
 * Validates an object against a schema and throws if invalid
 *
 * @param obj - Object to validate
 * @param schema - Validation schema
 * @throws ValidationError if validation fails
 */
export function validateObject(obj: Record<string, any>, schema: ValidationSchema): void {
  const result = validateForm(obj, schema)

  if (!result.valid) {
    throw new BaseValidationError("Validation failed", result.errors)
  }
}

/**
 * Validates a single value against constraints
 *
 * @param value - Value to validate
 * @param constraints - Validation constraints
 * @param fieldName - Field name for error context
 * @returns Whether the value is valid
 * @throws ValidationError if validation fails and throwError is true
 */
export function validateValue(
  value: any,
  constraints: ValidationConstraint | ValidationConstraint[],
  fieldName = "value",
  throwError = false,
): boolean {
  const result = validateForm({ [fieldName]: value }, { [fieldName]: constraints })

  if (!result.valid && throwError) {
    throw new BaseValidationError(`Invalid ${fieldName}`, result.errors)
  }

  return result.valid
}

/**
 * Validates a batch of values
 *
 * @param values - Values to validate
 * @param validationFn - Validation function
 * @returns Array of validation results
 */
export function validateBatch<T>(values: T[], validationFn: (value: T) => boolean): { value: T; valid: boolean }[] {
  return values.map((value) => ({
    value,
    valid: validationFn(value),
  }))
}

/**
 * Creates a validator function from a validation schema
 *
 * @param schema - Validation schema
 * @returns Validator function
 */
export function createValidator(schema: ValidationSchema): (data: Record<string, any>) => ValidationResult {
  return (data: Record<string, any>) => validateForm(data, schema)
}
