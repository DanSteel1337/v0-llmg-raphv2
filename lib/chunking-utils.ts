/**
 * Chunking Utilities
 *
 * Utility functions for text chunking and processing.
 * These functions are Edge-compatible and don't rely on any Node.js modules.
 *
 * Dependencies:
 * - None
 */

/**
 * Checks if a chunk is informative enough to be embedded
 */
function isInformativeChunk(text: string): boolean {
  if (!text || text.trim() === "") {
    return false
  }

  // Skip chunks that are too short
  if (text.trim().length < 10) {
    return false
  }

  // Skip chunks that don't have enough unique words
  const uniqueWords = new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 1),
  )

  if (uniqueWords.size < 3) {
    return false
  }

  return true
}

/**
 * Chunks a document into smaller pieces for processing
 */
export function chunkDocument(text: string, maxChunkSize: number, overlap = 100): string[] {
  // If text is smaller than max chunk size, return it as a single chunk
  if (text.length <= maxChunkSize) {
    return isInformativeChunk(text) ? [text] : []
  }

  // First try to split by natural sections like paragraphs
  const paragraphs = text.split(/\n\s*\n/)

  // If we have multiple paragraphs and they're all smaller than the max size,
  // we can group them into chunks
  if (paragraphs.length > 1 && paragraphs.every((p) => p.length < maxChunkSize)) {
    return groupParagraphsIntoChunks(paragraphs, maxChunkSize, overlap)
  }

  // Otherwise, fall back to splitting text directly
  return splitTextIntoChunks(text, maxChunkSize, overlap)
}

/**
 * Groups paragraphs into chunks of a specified maximum size
 */
function groupParagraphsIntoChunks(paragraphs: string[], maxChunkSize: number, overlap = 100): string[] {
  const chunks: string[] = []
  let currentChunk = ""

  for (const paragraph of paragraphs) {
    // Skip non-informative paragraphs
    if (!isInformativeChunk(paragraph)) {
      console.log("Skipping non-informative paragraph", {
        paragraphLength: paragraph.length,
        paragraphSample: paragraph.substring(0, 50) + "...",
      })
      continue
    }

    // If adding this paragraph would exceed the max size, store the current chunk and start a new one
    if (currentChunk.length + paragraph.length + 2 > maxChunkSize) {
      // +2 for the newlines
      if (currentChunk && isInformativeChunk(currentChunk)) {
        chunks.push(currentChunk)
      }

      // Start a new chunk
      currentChunk = paragraph
    } else {
      // Add paragraph to current chunk
      currentChunk = currentChunk ? currentChunk + "\n\n" + paragraph : paragraph
    }
  }

  // Add the last chunk if it's not empty and is informative
  if (currentChunk && isInformativeChunk(currentChunk)) {
    chunks.push(currentChunk)
  }

  return chunks
}

/**
 * Splits text into chunks of a specified size
 */
export function splitTextIntoChunks(text: string, maxChunkSize: number, overlap = 100): string[] {
  const chunks: string[] = []

  // If text is smaller than max chunk size, return it as a single chunk if informative
  if (text.length <= maxChunkSize) {
    return isInformativeChunk(text) ? [text] : []
  }

  let startIndex = 0

  while (startIndex < text.length) {
    // Calculate end index for this chunk
    let endIndex = startIndex + maxChunkSize

    // If we're not at the end of the text, try to find a natural break point
    if (endIndex < text.length) {
      // Look for a period, question mark, or exclamation mark followed by a space or newline
      const naturalBreakMatch = text
        .substring(Math.max(endIndex - 100, startIndex), Math.min(endIndex + 100, text.length))
        .match(/[.!?]\s+/)

      if (naturalBreakMatch && naturalBreakMatch.index !== undefined) {
        // Adjust endIndex to the natural break point
        endIndex = Math.max(endIndex - 100, startIndex) + naturalBreakMatch.index + naturalBreakMatch[0].length
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

    // Extract the chunk
    const chunk = text.substring(startIndex, endIndex)

    // Only add informative chunks
    if (isInformativeChunk(chunk)) {
      chunks.push(chunk)
    } else {
      console.log("Skipping non-informative chunk", {
        chunkLength: chunk.length,
        chunkSample: chunk.substring(0, 50) + "...",
      })
    }

    // Move the start index for the next chunk, accounting for overlap
    startIndex = endIndex - overlap

    // Make sure we're making progress
    if (startIndex >= endIndex) {
      startIndex = endIndex
    }
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
