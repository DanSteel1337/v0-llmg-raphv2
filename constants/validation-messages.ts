/**
 * Validation Messages
 *
 * Centralized validation error messages for the application.
 * These messages are used by both client and server validation functions.
 *
 * @module constants/validation-messages
 * @shared This module is used by both client and server code
 */

export const ValidationMessages = {
  // General validation messages
  required: "This field is required",
  invalid: "Invalid value",
  type: "Value must be a {type}",

  // String validation messages
  string: {
    minLength: "Must be at least {min} characters",
    maxLength: "Must be at most {max} characters",
    exactLength: "Must be exactly {length} characters",
    pattern: "Invalid format",
    email: "Invalid email address",
    url: "Invalid URL",
    alphanumeric: "Must contain only letters and numbers",
  },

  // Number validation messages
  number: {
    min: "Must be at least {min}",
    max: "Must be at most {max}",
    integer: "Must be an integer",
    positive: "Must be a positive number",
    negative: "Must be a negative number",
    between: "Must be between {min} and {max}",
  },

  // Date and time validation messages
  date: {
    invalid: "Invalid date",
    min: "Date must be after {min}",
    max: "Date must be before {max}",
    between: "Date must be between {min} and {max}",
  },

  // File validation messages
  file: {
    required: "Please select a file",
    type: "Invalid file type. Allowed types: {types}",
    size: "File is too large. Maximum size: {maxSize}",
    empty: "File cannot be empty",
  },

  // ID validation messages
  documentId: "Invalid document ID format",
  userId: "Invalid user ID format",
  chunkId: "Invalid chunk ID format",

  // Authentication validation messages
  auth: {
    invalidCredentials: "Invalid email or password",
    weakPassword: "Password is too weak",
    emailInUse: "Email is already in use",
    notAuthenticated: "You must be logged in to access this resource",
    notAuthorized: "You don't have permission to access this resource",
    sessionExpired: "Your session has expired. Please log in again",
  },

  // Request validation messages
  request: {
    invalidJson: "Invalid JSON in request body",
    missingFields: "Required fields are missing: {fields}",
    invalidContentType: "Invalid content type. Expected: {expected}",
    tooLarge: "Request is too large. Maximum size: {maxSize}",
  },

  // Data validation messages
  data: {
    notFound: "{resource} not found",
    alreadyExists: "{resource} already exists",
    invalidFormat: "Invalid {resource} format",
    invalidOperation: "Invalid operation: {operation}",
  },

  // Form validation messages
  form: {
    invalidSubmission: "Please fix the errors in the form before submitting",
    serverError: "An error occurred while processing your request",
    success: "Form submitted successfully",
  },

  // Custom validation messages
  custom: {
    invalidVector: "Invalid vector dimensions. Expected: {expected}, got: {actual}",
    emptyDocument: "Document contains no valid content to process",
    invalidEmbedding: "Invalid embedding format or dimensions",
    processingError: "Error processing document: {step}",
  },
}
