/**
 * Document Chunking Utilities
 *
 * Advanced utilities for splitting documents into semantically meaningful chunks
 * optimized for embedding and information retrieval.
 *
 * Features:
 * - Multiple chunking strategies (semantic, fixed-size, recursive, sliding window)
 * - Metadata preservation and enrichment
 * - Token estimation for embedding models
 * - Chunk validation and filtering
 * - Overlap control for context preservation
 * - Edge Runtime compatible (no Node.js specific modules)
 *
 * @module lib/chunking-utils
 */

// Types for chunk metadata and options
export interface ChunkMetadata {
  index: number
  documentId?: string
  chunkId?: string
  sourceType?: string
  sourceSection?: string
  heading?: string
  headingLevel?: number
  headingPath?: string[]
  startIndex?: number
  endIndex?: number
  tokenCount?: number
  isTable?: boolean
  isCode?: boolean
  isList?: boolean
  tags?: string[]
  createdAt: string
}

export interface Chunk {
  text: string
  metadata: ChunkMetadata
}

export interface ChunkingOptions {
  strategy?: "semantic" | "fixed" | "recursive" | "sliding" | "paragraph"
  maxChunkSize?: number
  minChunkSize?: number
  overlap?: number
  maxTokens?: number
  preserveHeaders?: boolean
  preserveStructure?: boolean
  includeMetadata?: boolean
  documentId?: string
  filterLowInfo?: boolean
  deduplicate?: boolean
}

// Default options
const DEFAULT_OPTIONS: ChunkingOptions = {
  strategy: "semantic",
  maxChunkSize: 1500,
  minChunkSize: 100,
  overlap: 150,
  maxTokens: 8000, // text-embedding-3-large has 8191 token limit
  preserveHeaders: true,
  preserveStructure: true,
  includeMetadata: true,
  filterLowInfo: true,
  deduplicate: true,
}

/**
 * Estimates the number of tokens in a text string
 * This is a simple approximation for OpenAI models
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0

  // Simple approximation: 1 token ≈ 4 characters for English text
  // This is a rough estimate and will vary by language and content
  const characterCount = text.length

  // Count words (better approximation than just characters)
  const wordCount = text.trim().split(/\s+/).length

  // Combine both metrics for a better estimate
  // Average English word is about 1.3 tokens
  const wordBasedEstimate = wordCount * 1.3
  const charBasedEstimate = characterCount / 4

  // Use the average of both methods
  return Math.ceil((wordBasedEstimate + charBasedEstimate) / 2)
}

/**
 * Checks if a chunk is informative enough to be embedded
 *
 * @param text - Text to check
 * @param minWords - Minimum number of unique words required
 * @returns True if chunk is informative
 */
export function isInformativeChunk(text: string, minWords = 3): boolean {
  if (!text || typeof text !== "string") {
    return false
  }

  const trimmed = text.trim()

  // Skip empty chunks
  if (trimmed === "") {
    return false
  }

  // Consider markdown content as informative
  if (trimmed.includes("#") || trimmed.includes("|") || trimmed.includes("```")) {
    return true
  }

  // Skip chunks that are too short
  if (trimmed.length < 10) {
    return false
  }

  // Skip chunks that don't have enough unique words
  const uniqueWords = new Set(
    trimmed
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 1),
  )

  if (uniqueWords.size < minWords) {
    return false
  }

  // Skip chunks that are just repetitive characters
  const repetitivePattern = /(.)\1{10,}/
  if (repetitivePattern.test(trimmed)) {
    return false
  }

  return true
}

/**
 * Normalizes text for consistent processing
 *
 * @param text - Text to normalize
 * @returns Normalized text
 */
function normalizeText(text: string): string {
  if (!text || typeof text !== "string") {
    return ""
  }

  return text
    .replace(/\r\n/g, "\n") // Normalize line endings
    .replace(/\n{3,}/g, "\n\n") // Reduce excessive newlines
    .replace(/\t/g, "  ") // Replace tabs with spaces
    .trim()
}

/**
 * Generates a unique chunk ID
 *
 * @param documentId - Parent document ID
 * @param index - Chunk index
 * @returns Unique chunk ID
 */
function generateChunkId(documentId?: string, index?: number): string {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000)
  const docPrefix = documentId ? documentId : `doc_${timestamp}`
  const indexSuffix = index !== undefined ? `_${index}` : `_${random}`

  return `chunk_${docPrefix}${indexSuffix}`
}

/**
 * Detects the structure type of a text segment
 *
 * @param text - Text to analyze
 * @returns Structure metadata
 */
function detectStructure(text: string): Pick<ChunkMetadata, "isTable" | "isCode" | "isList"> {
  const metadata: Pick<ChunkMetadata, "isTable" | "isCode" | "isList"> = {
    isTable: false,
    isCode: false,
    isList: false,
  }

  // Check for code blocks
  if (text.includes("```") || text.includes("    ") || text.includes("\t")) {
    metadata.isCode = true
  }

  // Check for tables
  if ((text.includes("|") && text.includes("-+-")) || text.includes("|--")) {
    metadata.isTable = true
  }

  // Check for lists
  if (/^[\s]*[-*+]\s/m.test(text) || /^[\s]*\d+\.\s/m.test(text)) {
    metadata.isList = true
  }

  return metadata
}

/**
 * Creates a chunk with metadata
 *
 * @param text - Chunk text content
 * @param index - Chunk index
 * @param options - Chunking options
 * @param additionalMetadata - Additional metadata to include
 * @returns Chunk object with metadata
 */
function createChunk(
  text: string,
  index: number,
  options: ChunkingOptions,
  additionalMetadata: Partial<ChunkMetadata> = {},
): Chunk {
  const chunkId = generateChunkId(options.documentId, index)
  const tokenCount = estimateTokenCount(text)
  const structureMetadata = detectStructure(text)

  const metadata: ChunkMetadata = {
    index,
    documentId: options.documentId,
    chunkId,
    tokenCount,
    createdAt: new Date().toISOString(),
    ...structureMetadata,
    ...additionalMetadata,
  }

  return {
    text,
    metadata,
  }
}

/**
 * Splits text by fixed size chunks with overlap
 *
 * @param text - Text to chunk
 * @param options - Chunking options
 * @returns Array of chunks
 */
function splitByFixedSize(text: string, options: ChunkingOptions): Chunk[] {
  const {
    maxChunkSize = DEFAULT_OPTIONS.maxChunkSize,
    overlap = DEFAULT_OPTIONS.overlap,
    documentId,
    includeMetadata = DEFAULT_OPTIONS.includeMetadata,
  } = options

  const normalizedText = normalizeText(text)

  if (normalizedText.length === 0) {
    return []
  }

  // If text is smaller than max chunk size, return it as a single chunk
  if (normalizedText.length <= maxChunkSize) {
    return [createChunk(normalizedText, 0, options)]
  }

  const chunks: Chunk[] = []
  let startIndex = 0
  let chunkIndex = 0

  while (startIndex < normalizedText.length) {
    // Determine end index for this chunk
    let endIndex = Math.min(startIndex + maxChunkSize, normalizedText.length)

    // If we're not at the end, try to find a natural break point
    if (endIndex < normalizedText.length) {
      // Try paragraph break
      let breakIndex = normalizedText.lastIndexOf("\n\n", endIndex)
      if (breakIndex > startIndex && breakIndex > endIndex - 200) {
        endIndex = breakIndex + 2 // Include the newlines
      } else {
        // Try sentence break
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

    // Extract the chunk text
    const chunkText = normalizedText.slice(startIndex, endIndex)

    // Create chunk with metadata
    chunks.push(
      createChunk(chunkText, chunkIndex, options, {
        startIndex,
        endIndex,
      }),
    )

    // Move start index for next chunk, accounting for overlap
    startIndex = endIndex - overlap

    // Ensure we're making progress
    if (startIndex >= normalizedText.length) {
      break
    }

    chunkIndex++
  }

  return chunks
}

/**
 * Splits text by paragraphs, grouping them into chunks
 *
 * @param text - Text to chunk
 * @param options - Chunking options
 * @returns Array of chunks
 */
function splitByParagraphs(text: string, options: ChunkingOptions): Chunk[] {
  const {
    maxChunkSize = DEFAULT_OPTIONS.maxChunkSize,
    minChunkSize = DEFAULT_OPTIONS.minChunkSize,
    documentId,
    filterLowInfo = DEFAULT_OPTIONS.filterLowInfo,
  } = options

  const normalizedText = normalizeText(text)

  if (normalizedText.length === 0) {
    return []
  }

  // If text is smaller than max chunk size, return it as a single chunk
  if (normalizedText.length <= maxChunkSize) {
    return [createChunk(normalizedText, 0, options)]
  }

  // Split text into paragraphs
  const paragraphs = normalizedText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  // Group paragraphs into chunks
  const chunks: Chunk[] = []
  let currentChunk = ""
  let chunkIndex = 0

  for (const paragraph of paragraphs) {
    // Skip non-informative paragraphs if filtering is enabled
    if (filterLowInfo && !isInformativeChunk(paragraph)) {
      continue
    }

    // If adding this paragraph would exceed the max size, store the current chunk and start a new one
    if (currentChunk.length + paragraph.length + 2 > maxChunkSize) {
      // Only add the chunk if it's informative and meets minimum size
      if (currentChunk && (!filterLowInfo || isInformativeChunk(currentChunk)) && currentChunk.length >= minChunkSize) {
        chunks.push(createChunk(currentChunk, chunkIndex, options))
        chunkIndex++
      }

      // Start a new chunk
      currentChunk = paragraph
    } else {
      // Add paragraph to current chunk
      currentChunk = currentChunk ? currentChunk + "\n\n" + paragraph : paragraph
    }
  }

  // Add the last chunk if it's not empty and meets criteria
  if (currentChunk && (!filterLowInfo || isInformativeChunk(currentChunk)) && currentChunk.length >= minChunkSize) {
    chunks.push(createChunk(currentChunk, chunkIndex, options))
  }

  return chunks
}

/**
 * Splits text using a sliding window approach
 *
 * @param text - Text to chunk
 * @param options - Chunking options
 * @returns Array of chunks
 */
function splitBySlidingWindow(text: string, options: ChunkingOptions): Chunk[] {
  const {
    maxChunkSize = DEFAULT_OPTIONS.maxChunkSize,
    overlap = DEFAULT_OPTIONS.overlap,
    documentId,
    filterLowInfo = DEFAULT_OPTIONS.filterLowInfo,
  } = options

  const normalizedText = normalizeText(text)

  if (normalizedText.length === 0) {
    return []
  }

  // If text is smaller than max chunk size, return it as a single chunk
  if (normalizedText.length <= maxChunkSize) {
    return [createChunk(normalizedText, 0, options)]
  }

  // Split text into sentences
  const sentenceRegex = /[.!?]+["'\s)]*\s+/g
  const sentences: string[] = []
  let lastIndex = 0
  let match

  // Reset regex
  sentenceRegex.lastIndex = 0

  while ((match = sentenceRegex.exec(normalizedText)) !== null) {
    const sentence = normalizedText.substring(lastIndex, match.index + match[0].length).trim()
    if (sentence) {
      sentences.push(sentence)
    }
    lastIndex = match.index + match[0].length
  }

  // Add the last sentence if there's any text left
  if (lastIndex < normalizedText.length) {
    const lastSentence = normalizedText.substring(lastIndex).trim()
    if (lastSentence) {
      sentences.push(lastSentence)
    }
  }

  // If no sentences were found (regex failed), fall back to fixed size chunking
  if (sentences.length === 0) {
    return splitByFixedSize(normalizedText, options)
  }

  // Create sliding windows of sentences
  const chunks: Chunk[] = []
  let currentChunk: string[] = []
  let currentLength = 0
  let chunkIndex = 0

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]

    // Add sentence to current chunk
    currentChunk.push(sentence)
    currentLength += sentence.length

    // If we've reached the max chunk size, create a chunk
    if (currentLength >= maxChunkSize) {
      const chunkText = currentChunk.join(" ")

      // Only add if it passes the filter
      if (!filterLowInfo || isInformativeChunk(chunkText)) {
        chunks.push(createChunk(chunkText, chunkIndex, options))
        chunkIndex++
      }

      // Calculate how many sentences to keep for overlap
      let overlapSentences = 0
      let overlapLength = 0

      for (let j = currentChunk.length - 1; j >= 0; j--) {
        overlapLength += currentChunk[j].length
        overlapSentences++

        if (overlapLength >= overlap) {
          break
        }
      }

      // Keep overlap sentences for the next chunk
      currentChunk = currentChunk.slice(currentChunk.length - overlapSentences)
      currentLength = currentChunk.reduce((sum, s) => sum + s.length, 0)
    }
  }

  // Add the last chunk if it's not empty
  if (currentChunk.length > 0) {
    const chunkText = currentChunk.join(" ")

    if (!filterLowInfo || isInformativeChunk(chunkText)) {
      chunks.push(createChunk(chunkText, chunkIndex, options))
    }
  }

  return chunks
}

/**
 * Splits text by headers to preserve document structure
 *
 * @param text - Text to chunk
 * @param options - Chunking options
 * @returns Array of chunks
 */
function splitBySemanticStructure(text: string, options: ChunkingOptions): Chunk[] {
  const {
    maxChunkSize = DEFAULT_OPTIONS.maxChunkSize,
    minChunkSize = DEFAULT_OPTIONS.minChunkSize,
    documentId,
    filterLowInfo = DEFAULT_OPTIONS.filterLowInfo,
    preserveHeaders = DEFAULT_OPTIONS.preserveHeaders,
  } = options

  const normalizedText = normalizeText(text)

  if (normalizedText.length === 0) {
    return []
  }

  // If text is smaller than max chunk size, return it as a single chunk
  if (normalizedText.length <= maxChunkSize) {
    return [createChunk(normalizedText, 0, options)]
  }

  // Extract sections with headers
  const sections = extractSections(normalizedText)

  // Process each section
  const chunks: Chunk[] = []
  let chunkIndex = 0
  const headingPath: string[] = []

  for (const section of sections) {
    // Track heading path for nested headers
    if (section.headingLevel !== undefined) {
      // Remove any headings at or deeper than the current level
      while (headingPath.length >= section.headingLevel) {
        headingPath.pop()
      }

      // Add current heading to the path
      if (section.heading) {
        headingPath.push(section.heading)
      }
    }

    // If section is small enough, keep it as a single chunk
    if (section.content.length <= maxChunkSize) {
      const sectionText =
        preserveHeaders && section.heading ? `# ${section.heading}\n\n${section.content}` : section.content

      if (!filterLowInfo || isInformativeChunk(sectionText)) {
        chunks.push(
          createChunk(sectionText, chunkIndex, options, {
            heading: section.heading,
            headingLevel: section.headingLevel,
            headingPath: [...headingPath],
            sourceSection: section.heading,
          }),
        )
        chunkIndex++
      }
    } else {
      // Section is too large, recursively chunk it
      // We'll use paragraph chunking for subsections to maintain coherence
      const subOptions: ChunkingOptions = {
        ...options,
        strategy: "paragraph",
      }

      const sectionContent =
        preserveHeaders && section.heading ? `# ${section.heading}\n\n${section.content}` : section.content

      const subChunks = splitByParagraphs(sectionContent, subOptions)

      // Add section metadata to each subchunk
      for (const subChunk of subChunks) {
        subChunk.metadata.heading = section.heading
        subChunk.metadata.headingLevel = section.headingLevel
        subChunk.metadata.headingPath = [...headingPath]
        subChunk.metadata.sourceSection = section.heading
        subChunk.metadata.index = chunkIndex

        chunks.push(subChunk)
        chunkIndex++
      }
    }
  }

  return chunks
}

/**
 * Extracts sections with headers from text
 *
 * @param text - Text to extract sections from
 * @returns Array of sections with headers and content
 */
function extractSections(text: string): Array<{
  heading?: string
  headingLevel?: number
  content: string
}> {
  // Regex for Markdown headers and Setext-style headers
  const headerRegex = /^(#{1,6})\s+(.+)$|^([^\n]+)\n([=-]{2,})$/gm
  const sections: Array<{
    heading?: string
    headingLevel?: number
    content: string
  }> = []

  let lastIndex = 0
  let match

  // Reset regex
  headerRegex.lastIndex = 0

  // Find all headers
  while ((match = headerRegex.exec(text)) !== null) {
    let heading: string
    let headingLevel: number
    const headerStart = match.index

    // Determine heading and level based on match type
    if (match[1]) {
      // ATX-style header (# Heading)
      heading = match[2].trim()
      headingLevel = match[1].length
    } else {
      // Setext-style header (Heading\n===== or Heading\n-----)
      heading = match[3].trim()
      headingLevel = match[4].charAt(0) === "=" ? 1 : 2
    }

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
    headerRegex.lastIndex = match.index + match[0].length
    const nextMatch = headerRegex.exec(text)

    // If we found another header, reset the regex position
    if (nextMatch) {
      headerRegex.lastIndex = match.index + match[0].length
    }

    const sectionEnd = nextMatch ? nextMatch.index : text.length

    // Extract content after the header
    const headerEnd = match.index + match[0].length
    const content = text.substring(headerEnd, sectionEnd).trim()

    // Add this section with its header
    if (content) {
      sections.push({
        heading,
        headingLevel,
        content,
      })
    }

    // Update lastIndex for next iteration
    lastIndex = sectionEnd

    // Reset regex to continue from the current position if we found a next match
    if (nextMatch) {
      headerRegex.lastIndex = match.index + match[0].length
    }
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

/**
 * Recursively splits text into chunks
 *
 * @param text - Text to chunk
 * @param options - Chunking options
 * @returns Array of chunks
 */
function splitRecursively(text: string, options: ChunkingOptions): Chunk[] {
  const {
    maxChunkSize = DEFAULT_OPTIONS.maxChunkSize,
    minChunkSize = DEFAULT_OPTIONS.minChunkSize,
    documentId,
    filterLowInfo = DEFAULT_OPTIONS.filterLowInfo,
  } = options

  const normalizedText = normalizeText(text)

  if (normalizedText.length === 0) {
    return []
  }

  // If text is smaller than max chunk size, return it as a single chunk
  if (normalizedText.length <= maxChunkSize) {
    return [createChunk(normalizedText, 0, options)]
  }

  // Try to split by headers first
  const sections = extractSections(normalizedText)

  // If we found multiple sections, process each one recursively
  if (sections.length > 1) {
    const chunks: Chunk[] = []
    let chunkIndex = 0

    for (const section of sections) {
      const sectionText = section.heading ? `# ${section.heading}\n\n${section.content}` : section.content

      // Recursively process this section
      const sectionChunks = splitRecursively(sectionText, {
        ...options,
        documentId,
      })

      // Add section metadata to each chunk
      for (const chunk of sectionChunks) {
        chunk.metadata.heading = section.heading
        chunk.metadata.headingLevel = section.headingLevel
        chunk.metadata.sourceSection = section.heading
        chunk.metadata.index = chunkIndex

        chunks.push(chunk)
        chunkIndex++
      }
    }

    return chunks
  }

  // If no headers, try to split by paragraphs
  const paragraphs = normalizedText.split(/\n\s*\n/).filter((p) => p.trim().length > 0)

  if (paragraphs.length > 1) {
    return splitByParagraphs(normalizedText, options)
  }

  // If we can't split by headers or paragraphs, fall back to fixed size chunking
  return splitByFixedSize(normalizedText, options)
}

/**
 * Removes duplicate chunks from an array
 *
 * @param chunks - Array of chunks to deduplicate
 * @returns Deduplicated array of chunks
 */
function deduplicateChunks(chunks: Chunk[]): Chunk[] {
  const seen = new Set<string>()
  const result: Chunk[] = []

  for (const chunk of chunks) {
    // Create a normalized version of the text for comparison
    const normalizedText = chunk.text.trim().toLowerCase()

    // Skip if we've seen this text before
    if (seen.has(normalizedText)) {
      continue
    }

    seen.add(normalizedText)
    result.push(chunk)
  }

  // Update indices to be sequential
  result.forEach((chunk, index) => {
    chunk.metadata.index = index
  })

  return result
}

/**
 * Main function to split a document into chunks
 *
 * @param text - Document text to chunk
 * @param options - Chunking options
 * @returns Array of chunks with metadata
 */
export function chunkDocument(
  text: string,
  maxChunkSize: number = DEFAULT_OPTIONS.maxChunkSize,
  overlap: number = DEFAULT_OPTIONS.overlap,
): string[] {
  // For backward compatibility, convert to string array
  const chunks = splitText(text, {
    maxChunkSize,
    overlap,
    strategy: "fixed",
  })

  return chunks.map((chunk) => chunk.text)
}

/**
 * Advanced function to split text into chunks with metadata
 *
 * @param text - Text to split into chunks
 * @param options - Chunking options
 * @returns Array of chunks with metadata
 */
export function splitText(text: string, options: ChunkingOptions = {}): Chunk[] {
  // Merge with default options
  const mergedOptions: ChunkingOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  if (!text || typeof text !== "string") {
    console.error("Invalid text provided for chunking:", text)
    return []
  }

  const normalizedText = normalizeText(text)

  if (normalizedText.length === 0) {
    return []
  }

  let chunks: Chunk[]

  // Choose chunking strategy
  switch (mergedOptions.strategy) {
    case "semantic":
      chunks = splitBySemanticStructure(normalizedText, mergedOptions)
      break
    case "fixed":
      chunks = splitByFixedSize(normalizedText, mergedOptions)
      break
    case "recursive":
      chunks = splitRecursively(normalizedText, mergedOptions)
      break
    case "sliding":
      chunks = splitBySlidingWindow(normalizedText, mergedOptions)
      break
    case "paragraph":
      chunks = splitByParagraphs(normalizedText, mergedOptions)
      break
    default:
      chunks = splitBySemanticStructure(normalizedText, mergedOptions)
  }

  // Filter low-information chunks if requested
  if (mergedOptions.filterLowInfo) {
    chunks = chunks.filter((chunk) => isInformativeChunk(chunk.text))
  }

  // Deduplicate chunks if requested
  if (mergedOptions.deduplicate) {
    chunks = deduplicateChunks(chunks)
  }

  // Update indices to be sequential
  chunks.forEach((chunk, index) => {
    chunk.metadata.index = index
  })

  return chunks
}

/**
 * Splits text by headers to preserve document structure
 *
 * @param text - Text to split
 * @returns Array of sections with headers and content
 */
export function splitByHeaders(text: string): { header?: string; content: string }[] {
  const sections = extractSections(normalizeText(text))

  return sections.map((section) => ({
    header: section.heading,
    content: section.content,
  }))
}

/**
 * Splits text into chunks optimized for embedding
 *
 * @param text - Text to split
 * @param options - Chunking options
 * @returns Array of chunks with metadata
 */
export function splitForEmbedding(text: string, options: ChunkingOptions = {}): Chunk[] {
  // Default to semantic chunking for embedding
  const embeddingOptions: ChunkingOptions = {
    ...DEFAULT_OPTIONS,
    strategy: "semantic",
    maxTokens: 8000, // text-embedding-3-large limit
    filterLowInfo: true,
    deduplicate: true,
    ...options,
  }

  const chunks = splitText(text, embeddingOptions)

  // Ensure chunks don't exceed token limits
  return chunks.map((chunk) => {
    const tokenCount = estimateTokenCount(chunk.text)

    // If chunk exceeds token limit, truncate it
    if (tokenCount > embeddingOptions.maxTokens!) {
      const ratio = embeddingOptions.maxTokens! / tokenCount
      const newLength = Math.floor(chunk.text.length * ratio) - 100 // Leave some margin

      chunk.text = chunk.text.substring(0, newLength) + "..."
      chunk.metadata.tokenCount = estimateTokenCount(chunk.text)
    } else {
      chunk.metadata.tokenCount = tokenCount
    }

    return chunk
  })
}
