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
 * Detects if a position is inside a fenced code block
 * @param text The full text
 * @param position The position to check
 * @returns True if the position is inside a code block
 */
function isInsideCodeBlock(text: string, position: number): boolean {
  // Look for code fence markers (\`\`\`) before the position
  const textBeforePosition = text.substring(0, position)
  const fenceMatches = textBeforePosition.match(/```/g)

  // If we have no fence markers or an even number, we're not in a code block
  if (!fenceMatches || fenceMatches.length % 2 === 0) {
    return false
  }

  // If we have an odd number of fence markers, we're inside a code block
  return true
}

/**
 * Detects if a position is inside an indented code block
 * @param text The full text
 * @param position The position to check
 * @returns True if the position is inside an indented code block
 */
function isInsideIndentedCodeBlock(text: string, position: number): boolean {
  // Find the start of the line containing the position
  const lineStart = text.lastIndexOf("\n", position - 1) + 1
  const line = text.substring(lineStart, text.indexOf("\n", position) || text.length)

  // Check if the line starts with 4 spaces or a tab
  return line.startsWith("    ") || line.startsWith("\t")
}

/**
 * Finds the end of a code block starting from a position
 * @param text The full text
 * @param position The starting position (inside a code block)
 * @returns The position of the end of the code block
 */
function findCodeBlockEnd(text: string, position: number): number {
  // For fenced code blocks
  if (isInsideCodeBlock(text, position)) {
    const nextFence = text.indexOf("```", position)
    return nextFence !== -1 ? nextFence + 3 : text.length
  }

  // For indented code blocks, find where indentation ends
  if (isInsideIndentedCodeBlock(text, position)) {
    const lines = text.substring(position).split("\n")
    let endPos = position

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (i > 0 && !(line.startsWith("    ") || line.startsWith("\t") || line.trim() === "")) {
        break
      }
      endPos += lines[i].length + 1 // +1 for the newline
    }

    return endPos
  }

  return position
}

/**
 * Split a document into chunks with optional overlap
 *
 * @param text The document text to chunk
 * @param maxChunkSize Maximum size of each chunk
 * @param overlap Number of characters to overlap between chunks
 * @returns Array of text chunks
 */
export function chunkDocument(text: string, maxChunkSize = 1500, overlap = 150): string[] {
  if (!text || typeof text !== "string") {
    console.error("Invalid text provided for chunking:", text)
    return []
  }

  // Normalize line endings and remove excessive whitespace
  const normalizedText = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  if (normalizedText.length === 0) {
    return []
  }

  // If text is smaller than max chunk size, return it as a single chunk
  if (normalizedText.length <= maxChunkSize) {
    return [normalizedText]
  }

  const chunks: string[] = []
  let startIndex = 0

  while (startIndex < normalizedText.length) {
    // Determine end index for this chunk
    let endIndex = startIndex + maxChunkSize

    // If we're at the end of the text, just use the remainder
    if (endIndex >= normalizedText.length) {
      chunks.push(normalizedText.slice(startIndex))
      break
    }

    // Check if we're inside a code block at the potential end position
    if (isInsideCodeBlock(normalizedText, endIndex) || isInsideIndentedCodeBlock(normalizedText, endIndex)) {
      // Find the end of the code block
      endIndex = findCodeBlockEnd(normalizedText, endIndex)

      // If the code block is too large, we need to find a break point before it
      if (endIndex - startIndex > maxChunkSize * 1.5) {
        // Find the start of the code block
        const codeBlockStart = normalizedText.lastIndexOf("```", endIndex - 1)
        if (codeBlockStart > startIndex) {
          // Use the position right before the code block starts
          endIndex = codeBlockStart
        } else {
          // If we can't find a good break point, just use the max length
          endIndex = startIndex + maxChunkSize
        }
      }
    } else {
      // Try to find a natural break point (paragraph, sentence, or word boundary)
      // Look for paragraph break
      let breakIndex = normalizedText.lastIndexOf("\n\n", endIndex)
      if (breakIndex > startIndex && breakIndex > endIndex - 200) {
        endIndex = breakIndex + 2 // Include the newlines
      } else {
        // Look for sentence break (period followed by space or newline)
        breakIndex = normalizedText.lastIndexOf(". ", endIndex)
        if (breakIndex === -1) breakIndex = normalizedText.lastIndexOf(".\n", endIndex)

        if (breakIndex > startIndex && breakIndex > endIndex - 100) {
          endIndex = breakIndex + 2 // Include the period and space/newline
        } else {
          // Fall back to word boundary
          breakIndex = normalizedText.lastIndexOf(" ", endIndex)
          if (breakIndex > startIndex) {
            endIndex = breakIndex + 1 // Include the space
          }
          // If no good break point found, just use the max length
        }
      }
    }

    // Add the chunk
    chunks.push(normalizedText.slice(startIndex, endIndex))

    // Move start index for next chunk, accounting for overlap
    startIndex = endIndex - overlap

    // Ensure we're making progress
    if (startIndex >= normalizedText.length) {
      break
    }
  }

  return chunks
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
