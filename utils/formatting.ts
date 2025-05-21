/**
 * Formatting Utilities
 *
 * A comprehensive set of utility functions for formatting text, dates, numbers,
 * and other data types throughout the serverless RAG application.
 *
 * @module utils/formatting
 */

/**
 * Checks if a value is a valid date
 * @param date - Value to check
 * @returns True if the value is a valid date
 */
export function isValidDate(date: any): boolean {
  if (date === null || date === undefined) return false

  // If it's already a Date object
  if (date instanceof Date) return !isNaN(date.getTime())

  // If it's a number (timestamp)
  if (typeof date === "number") return !isNaN(new Date(date).getTime())

  // If it's a string, try to parse it
  if (typeof date === "string") {
    // Handle empty strings
    if (date.trim() === "") return false

    const parsedDate = new Date(date)
    return !isNaN(parsedDate.getTime())
  }

  return false
}

/**
 * Parses a date string into a Date object
 * @param dateString - Date string to parse
 * @returns Parsed Date object or null if invalid
 */
export function parseDate(dateString: string): Date | null {
  try {
    if (!dateString) return null

    const date = new Date(dateString)
    return isNaN(date.getTime()) ? null : date
  } catch (error) {
    console.error("Error parsing date:", error)
    return null
  }
}

/**
 * Gets the timezone offset in minutes for a specific timezone
 * @param timezone - IANA timezone string (e.g., 'America/New_York')
 * @returns Timezone offset in minutes or 0 if unavailable
 */
export function getTimezoneOffset(timezone?: string): number {
  try {
    if (!timezone) {
      return new Date().getTimezoneOffset()
    }

    // Get current date in the specified timezone
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      timeZoneName: "short",
    }

    // This is a workaround as there's no direct way to get timezone offset
    // for a specific timezone in vanilla JS
    const formatter = new Intl.DateTimeFormat("en-US", options)
    const timeZonePart = formatter.formatToParts(new Date()).find((part) => part.type === "timeZoneName")

    if (!timeZonePart) return 0

    // Parse the timezone offset from the formatted string
    // This is a simplified approach and might not work for all cases
    const match = timeZonePart.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
    if (!match) return 0

    const sign = match[1] === "-" ? 1 : -1 // Note: getTimezoneOffset() returns opposite sign
    const hours = Number.parseInt(match[2], 10) || 0
    const minutes = Number.parseInt(match[3], 10) || 0

    return sign * (hours * 60 + minutes)
  } catch (error) {
    console.error("Error getting timezone offset:", error)
    return 0
  }
}

/**
 * Gets the name of a month
 * @param month - Month index (0-11)
 * @param short - Whether to return the short name
 * @returns Month name
 */
export function getMonthName(month: number, short = false): string {
  try {
    if (month < 0 || month > 11) {
      throw new Error("Month index must be between 0 and 11")
    }

    const date = new Date()
    date.setMonth(month)

    return date.toLocaleString("en-US", {
      month: short ? "short" : "long",
    })
  } catch (error) {
    console.error("Error getting month name:", error)
    return ""
  }
}

/**
 * Gets the name of a day of the week
 * @param day - Day index (0-6, where 0 is Sunday)
 * @param short - Whether to return the short name
 * @returns Day name
 */
export function getDayName(day: number, short = false): string {
  try {
    if (day < 0 || day > 6) {
      throw new Error("Day index must be between 0 and 6")
    }

    const date = new Date()
    date.setDate(date.getDate() - date.getDay() + day)

    return date.toLocaleString("en-US", {
      weekday: short ? "short" : "long",
    })
  } catch (error) {
    console.error("Error getting day name:", error)
    return ""
  }
}

/**
 * Formats a date according to the specified format
 * @param date - Date to format
 * @param format - Optional format string (defaults to 'MMM d, yyyy')
 * @returns Formatted date string
 */
export function formatDate(date: Date | string | number, format?: string): string {
  try {
    if (!date) return ""

    const dateObj = date instanceof Date ? date : new Date(date)
    if (!isValidDate(dateObj)) return ""

    // Default format: 'MMM d, yyyy' (e.g., "Jan 1, 2023")
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
    }

    // Custom format handling
    if (format) {
      // This is a simplified format parser
      // For a full solution, consider using a date library
      if (format === "yyyy-MM-dd") {
        return dateObj.toISOString().split("T")[0]
      } else if (format === "MM/dd/yyyy") {
        options.month = "numeric"
        options.day = "numeric"
        options.year = "numeric"
      } else if (format === "MMM yyyy") {
        options.month = "short"
        options.year = "numeric"
        delete options.day
      } else if (format === "MMMM d, yyyy") {
        options.month = "long"
      }
    }

    return new Intl.DateTimeFormat("en-US", options).format(dateObj)
  } catch (error) {
    console.error("Error formatting date:", error)
    return String(date)
  }
}

/**
 * Formats a date with time according to the specified format
 * @param date - Date to format
 * @param format - Optional format string (defaults to 'MMM d, yyyy h:mm a')
 * @returns Formatted date and time string
 */
export function formatDateTime(date: Date | string | number, format?: string): string {
  try {
    if (!date) return ""

    const dateObj = date instanceof Date ? date : new Date(date)
    if (!isValidDate(dateObj)) return ""

    // Default format: 'MMM d, yyyy h:mm a' (e.g., "Jan 1, 2023 3:30 PM")
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }

    // Custom format handling
    if (format) {
      if (format === "yyyy-MM-dd HH:mm:ss") {
        const isoString = dateObj.toISOString()
        return `${isoString.split("T")[0]} ${isoString.split("T")[1].substring(0, 8)}`
      } else if (format === "MM/dd/yyyy HH:mm") {
        options.month = "numeric"
        options.hour12 = false
      } else if (format === "full") {
        options.second = "2-digit"
        options.timeZoneName = "short"
      }
    }

    return new Intl.DateTimeFormat("en-US", options).format(dateObj)
  } catch (error) {
    console.error("Error formatting date time:", error)
    return String(date)
  }
}

/**
 * Formats a date as a relative time string (e.g., "2 hours ago")
 * @param date - Date to format
 * @returns Relative time string
 */
export function formatRelativeTime(date: Date | string | number): string {
  try {
    if (!date) return ""

    const dateObj = date instanceof Date ? date : new Date(date)
    if (!isValidDate(dateObj)) return ""

    const now = new Date()
    const diffMs = now.getTime() - dateObj.getTime()

    // Use Intl.RelativeTimeFormat if available
    if (typeof Intl !== "undefined" && Intl.RelativeTimeFormat) {
      const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

      const diffSeconds = Math.round(diffMs / 1000)
      const diffMinutes = Math.round(diffSeconds / 60)
      const diffHours = Math.round(diffMinutes / 60)
      const diffDays = Math.round(diffHours / 24)
      const diffWeeks = Math.round(diffDays / 7)
      const diffMonths = Math.round(diffDays / 30)
      const diffYears = Math.round(diffDays / 365)

      if (diffSeconds < 60) {
        return rtf.format(-diffSeconds, "second")
      }
      if (diffMinutes < 60) {
        return rtf.format(-diffMinutes, "minute")
      }
      if (diffHours < 24) {
        return rtf.format(-diffHours, "hour")
      }
      if (diffDays < 7) {
        return rtf.format(-diffDays, "day")
      }
      if (diffWeeks < 4) {
        return rtf.format(-diffWeeks, "week")
      }
      if (diffMonths < 12) {
        return rtf.format(-diffMonths, "month")
      }
      return rtf.format(-diffYears, "year")
    }

    // Fallback for browsers without RelativeTimeFormat
    const seconds = Math.floor(diffMs / 1000)

    if (seconds < 60) return `${seconds} seconds ago`

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`

    const days = Math.floor(hours / 24)
    if (days < 30) return `${days} day${days !== 1 ? "s" : ""} ago`

    const months = Math.floor(days / 30)
    if (months < 12) return `${months} month${months !== 1 ? "s" : ""} ago`

    const years = Math.floor(days / 365)
    return `${years} year${years !== 1 ? "s" : ""} ago`
  } catch (error) {
    console.error("Error formatting relative time:", error)
    return formatDate(date)
  }
}

/**
 * Formats a time range between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Formatted time range string
 */
export function formatTimeRange(startDate: Date | string, endDate: Date | string): string {
  try {
    if (!startDate || !endDate) return ""

    const start = startDate instanceof Date ? startDate : new Date(startDate)
    const end = endDate instanceof Date ? endDate : new Date(endDate)

    if (!isValidDate(start) || !isValidDate(end)) return ""

    // If dates are on the same day
    if (start.toDateString() === end.toDateString()) {
      return `${formatDate(start)} ${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    }

    // If dates are in the same month and year
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${start.getDate()} - ${end.getDate()} ${getMonthName(start.getMonth())} ${start.getFullYear()}`
    }

    // If dates are in the same year
    if (start.getFullYear() === end.getFullYear()) {
      return `${getMonthName(start.getMonth(), true)} ${start.getDate()} - ${getMonthName(end.getMonth(), true)} ${end.getDate()}, ${start.getFullYear()}`
    }

    // Different years
    return `${formatDate(start)} - ${formatDate(end)}`
  } catch (error) {
    console.error("Error formatting time range:", error)
    return `${String(startDate)} - ${String(endDate)}`
  }
}

/**
 * Checks if a date is today
 * @param date - Date to check
 * @returns True if the date is today
 */
export function isToday(date: Date | string | number): boolean {
  try {
    if (!date) return false

    const dateObj = date instanceof Date ? date : new Date(date)
    if (!isValidDate(dateObj)) return false

    const today = new Date()
    return (
      dateObj.getDate() === today.getDate() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getFullYear() === today.getFullYear()
    )
  } catch (error) {
    console.error("Error checking if date is today:", error)
    return false
  }
}

/**
 * Checks if a date is yesterday
 * @param date - Date to check
 * @returns True if the date is yesterday
 */
export function isYesterday(date: Date | string | number): boolean {
  try {
    if (!date) return false

    const dateObj = date instanceof Date ? date : new Date(date)
    if (!isValidDate(dateObj)) return false

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    return (
      dateObj.getDate() === yesterday.getDate() &&
      dateObj.getMonth() === yesterday.getMonth() &&
      dateObj.getFullYear() === yesterday.getFullYear()
    )
  } catch (error) {
    console.error("Error checking if date is yesterday:", error)
    return false
  }
}

/**
 * Truncates text to a specified length
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to add to truncated text (default: "...")
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number, suffix = "..."): string {
  if (!text) return ""
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + suffix
}

/**
 * Capitalizes the first letter of a string
 * @param text - Text to capitalize
 * @returns Text with first letter capitalized
 */
export function capitalizeFirstLetter(text: string): string {
  if (!text) return ""
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Converts a string to a URL-friendly slug
 * @param text - Text to slugify
 * @returns Slugified text
 */
export function slugify(text: string): string {
  if (!text) return ""

  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/&/g, "-and-") // Replace & with 'and'
    .replace(/[^\w-]+/g, "") // Remove all non-word characters
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, "") // Trim - from end of text
}

/**
 * Strips HTML tags from a string
 * @param html - HTML string to strip
 * @returns Plain text without HTML tags
 */
export function stripHtml(html: string): string {
  if (!html) return ""

  // Create a temporary element to safely parse HTML
  const tempElement = document.createElement("div")
  tempElement.innerHTML = html

  // Get the text content
  const text = tempElement.textContent || tempElement.innerText || ""

  // Clean up any excessive whitespace
  return text.replace(/\s+/g, " ").trim()
}

/**
 * Returns singular or plural form of a word based on count
 * @param word - Singular form of the word
 * @param count - Count to determine plurality
 * @param plural - Optional custom plural form
 * @returns Appropriate form of the word
 */
export function pluralize(word: string, count: number, plural?: string): string {
  if (!word) return ""

  if (count === 1) {
    return word
  }

  if (plural) {
    return plural
  }

  // Simple English pluralization rules
  if (word.endsWith("y") && !["ay", "ey", "iy", "oy", "uy"].some((ending) => word.endsWith(ending))) {
    return word.slice(0, -1) + "ies"
  }

  if (word.endsWith("s") || word.endsWith("x") || word.endsWith("z") || word.endsWith("ch") || word.endsWith("sh")) {
    return word + "es"
  }

  return word + "s"
}

/**
 * Highlights occurrences of a query in text
 * @param text - Text to search in
 * @param query - Query to highlight
 * @param highlightClass - CSS class for highlighting (default: "highlight")
 * @returns HTML string with highlighted query
 */
export function highlightText(text: string, query: string, highlightClass = "highlight"): string {
  if (!text || !query) return text || ""

  try {
    // Escape special regex characters in the query
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

    // Create a regex that matches the query (case insensitive)
    const regex = new RegExp(`(${escapedQuery})`, "gi")

    // Replace matches with highlighted version
    return text.replace(regex, `<span class="${highlightClass}">$1</span>`)
  } catch (error) {
    console.error("Error highlighting text:", error)
    return text
  }
}

/**
 * Formats a file size in bytes to a human-readable format
 * @param bytes - File size in bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes"
  if (isNaN(bytes) || bytes < 0) return "Invalid size"

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

/**
 * Formats a number with various options
 * @param num - Number to format
 * @param options - Formatting options
 * @returns Formatted number string
 */
export function formatNumber(num: number, options: Intl.NumberFormatOptions = {}): string {
  if (num === null || num === undefined || isNaN(num)) return ""

  try {
    return new Intl.NumberFormat("en-US", options).format(num)
  } catch (error) {
    console.error("Error formatting number:", error)
    return String(num)
  }
}

/**
 * Formats a number as a percentage
 * @param value - Number to format as percentage
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals = 1): string {
  if (value === null || value === undefined || isNaN(value)) return ""

  try {
    return `${value.toFixed(decimals)}%`
  } catch (error) {
    console.error("Error formatting percentage:", error)
    return `${value}%`
  }
}

/**
 * Formats a number as currency
 * @param value - Number to format as currency
 * @param currency - Currency code (default: "USD")
 * @param locale - Locale code (default: "en-US")
 * @returns Formatted currency string
 */
export function formatCurrency(value: number, currency = "USD", locale = "en-US"): string {
  if (value === null || value === undefined || isNaN(value)) return ""

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch (error) {
    console.error("Error formatting currency:", error)
    return `${currency} ${value}`
  }
}

/**
 * Formats a duration in milliseconds to a human-readable format
 * @param milliseconds - Duration in milliseconds
 * @param format - Format string (default: "auto")
 * @returns Formatted duration string
 */
export function formatDuration(milliseconds: number, format = "auto"): string {
  if (milliseconds === null || milliseconds === undefined || isNaN(milliseconds)) return ""
  if (milliseconds < 0) return "Invalid duration"

  try {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    // Format based on the specified format
    if (format === "auto") {
      // Choose appropriate format based on duration
      if (milliseconds < 1000) {
        return `${milliseconds}ms`
      } else if (seconds < 60) {
        return `${seconds}s`
      } else if (minutes < 60) {
        return `${minutes}m ${seconds % 60}s`
      } else if (hours < 24) {
        return `${hours}h ${minutes % 60}m`
      } else {
        return `${days}d ${hours % 24}h`
      }
    } else if (format === "full") {
      // Full format with all units
      return `${days ? days + "d " : ""}${hours % 24 ? (hours % 24) + "h " : ""}${minutes % 60 ? (minutes % 60) + "m " : ""}${seconds % 60}s`
    } else if (format === "compact") {
      // Compact format with largest unit only
      if (days > 0) return `${days}d`
      if (hours > 0) return `${hours}h`
      if (minutes > 0) return `${minutes}m`
      return `${seconds}s`
    } else if (format === "colons") {
      // HH:MM:SS format
      const h = hours.toString().padStart(2, "0")
      const m = (minutes % 60).toString().padStart(2, "0")
      const s = (seconds % 60).toString().padStart(2, "0")
      return days > 0 ? `${days}:${h}:${m}:${s}` : `${h}:${m}:${s}`
    }

    // Default to auto format if format is not recognized
    return formatDuration(milliseconds, "auto")
  } catch (error) {
    console.error("Error formatting duration:", error)
    return `${milliseconds}ms`
  }
}

/**
 * Formats an object as a pretty-printed JSON string
 * @param obj - Object to format
 * @param spaces - Number of spaces for indentation (default: 2)
 * @returns Formatted JSON string
 */
export function formatJSONString(obj: any, spaces = 2): string {
  if (obj === null || obj === undefined) return ""

  try {
    return JSON.stringify(obj, null, spaces)
  } catch (error) {
    console.error("Error formatting JSON string:", error)
    return String(obj)
  }
}

/**
 * Formats an array of items into a comma-separated list
 * @param items - Array of items to format
 * @param separator - Separator between items (default: ", ")
 * @param lastSeparator - Separator before the last item (default: " and ")
 * @returns Formatted list string
 */
export function formatList(items: string[], separator = ", ", lastSeparator = " and "): string {
  if (!items || !Array.isArray(items)) return ""
  if (items.length === 0) return ""
  if (items.length === 1) return items[0]

  const lastItem = items[items.length - 1]
  const otherItems = items.slice(0, -1)

  return otherItems.join(separator) + lastSeparator + lastItem
}

/**
 * Formats an address object into a string
 * @param address - Address object with various fields
 * @returns Formatted address string
 */
export function formatAddress(address: {
  street1?: string
  street2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}): string {
  if (!address) return ""

  const parts: string[] = []

  if (address.street1) parts.push(address.street1)
  if (address.street2) parts.push(address.street2)

  const cityStateZip: string[] = []
  if (address.city) cityStateZip.push(address.city)
  if (address.state) cityStateZip.push(address.state)
  if (address.zip) cityStateZip.push(address.zip)

  if (cityStateZip.length > 0) {
    parts.push(cityStateZip.join(", "))
  }

  if (address.country) parts.push(address.country)

  return parts.join("\n")
}

/**
 * Formats a name from its components
 * @param firstName - First name
 * @param lastName - Last name
 * @param middleName - Optional middle name
 * @returns Formatted full name
 */
export function formatName(firstName: string, lastName: string, middleName?: string): string {
  if (!firstName && !lastName) return ""

  const parts: string[] = []

  if (firstName) parts.push(firstName)
  if (middleName) parts.push(middleName)
  if (lastName) parts.push(lastName)

  return parts.join(" ")
}
