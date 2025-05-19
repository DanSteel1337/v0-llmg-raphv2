/**
 * Chunking Utilities
 *
 * Utility functions for text chunking and processing.
 *
 * Dependencies:
 * - None
 */

/**
 * Splits text into chunks of a specified size
 */
export function splitTextIntoChunks(text: string, maxChunkSize: number, overlap = 0): string[] {
  const chunks: string[] = []

  // If text is smaller than max chunk size, return it as a single chunk
  if (text.length <= maxChunkSize) {
    return [text]
  }

  let startIndex = 0

  while (startIndex < text.length) {
    // Calculate end index for this chunk
    let endIndex = startIndex + maxChunkSize

    // If we're not at the end of the text, try to find a natural break point
    if (endIndex < text.length) {
      // Look for a period, question mark, or exclamation mark followed by a space or newline
      const naturalBreakMatch = text.substring(endIndex - 100, endIndex + 100).match(/[.!?]\s+/g)

      if (naturalBreakMatch && naturalBreakMatch.index !== undefined) {
        // Adjust endIndex to the natural break point
        endIndex = endIndex - 100 + naturalBreakMatch.index + naturalBreakMatch[0].length
      } else {
        // If no natural break found, look for a space
        const lastSpace = text.lastIndexOf(" ", endIndex)
        if (lastSpace > startIndex) {
          endIndex = lastSpace + 1
        }
      }
    } else {
      // If we're at the end of the text, just use the end
      endIndex = text.length
    }

    // Add this chunk to the list
    chunks.push(text.substring(startIndex, endIndex))

    // Move the start index for the next chunk, accounting for overlap
    startIndex = endIndex - overlap
  }

  return chunks
}

/**
 * Splits text by headers to preserve document structure
 */
export function splitByHeaders(text: string): { header?: string; content: string }[] {
  const headerRegex = /#{1,6}\s+(.+)$|^(.+)\n[=-]{2,}$/gm
  const sections: { header?: string; content: string }[] = []

  let lastIndex = 0
  let match

  // Find all headers
  while ((match = headerRegex.exec(text)) !== null) {
    const headerText = match[1] || match[2]
    const headerStart = match.index

    // If this isn't the first header, add the previous section
    if (headerStart > lastIndex) {
      const previousContent = text.substring(lastIndex, headerStart).trim()

      if (previousContent) {
        sections.push({
          content: previousContent,
        })
      }
    }

    // Find the end of this section (start of next header or end of text)
    const nextMatch = headerRegex.exec(text)
    const sectionEnd = nextMatch ? nextMatch.index : text.length

    // Add this section with its header
    const content = text.substring(headerStart, sectionEnd).trim()

    if (content) {
      sections.push({
        header: headerText,
        content,
      })
    }

    // Reset regex to continue from the current position
    headerRegex.lastIndex = headerStart + 1
    lastIndex = sectionEnd
  }

  // Add the final section if there's content after the last header
  if (lastIndex < text.length) {
    const remainingContent = text.substring(lastIndex).trim()

    if (remainingContent) {
      sections.push({
        content: remainingContent,
      })
    }
  }

  // If no headers were found, return the entire text as one section
  if (sections.length === 0) {
    sections.push({
      content: text,
    })
  }

  return sections
}
