/**
 * Document Service
 *
 * Handles document management operations including:
 * - Document creation, retrieval, and deletion
 * - Document processing and chunking
 * - Text extraction and embedding generation
 * - Vector storage in Pinecone
 *
 * Dependencies:
 * - @/lib/pinecone-client.ts for vector storage
 * - @/lib/supabase-client.ts for file storage
 * - @/lib/embedding-service.ts for embeddings
 * - uuid for ID generation
 */

import { v4 as uuidv4 } from "uuid"
import { getPineconeIndex } from "@/lib/pinecone-client"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { generateEmbedding } from "@/lib/embedding-service"
import type { Document, DocumentChunk, ProcessDocumentOptions } from "@/types"

// Constants
const DEFAULT_CHUNK_SIZE = 1000
const DEFAULT_CHUNK_OVERLAP = 200
const EMBEDDING_BATCH_SIZE = 10
const VECTOR_DIMENSION = 1536

/**
 * Creates a new document record
 */
export async function createDocument(
  userId: string,
  name: string,
  description: string | undefined,
  fileType: string,
  fileSize: number,
  filePath: string,
): Promise<Document> {
  const pineconeIndex = await getPineconeIndex()
  const documentId = uuidv4()
  const now = new Date().toISOString()

  const document: Document = {
    id: documentId,
    user_id: userId,
    name,
    description,
    file_type: fileType,
    file_size: fileSize,
    file_path: filePath,
    status: "processing",
    processing_progress: 0,
    created_at: now,
    updated_at: now,
  }

  await pineconeIndex.upsert({
    upsertRequest: {
      vectors: [
        {
          id: documentId,
          values: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector
          metadata: {
            ...document,
            record_type: "document",
          },
        },
      ],
      namespace: "",
    },
  })

  return document
}

/**
 * Gets all documents for a user
 */
export async function getDocumentsByUserId(userId: string): Promise<Document[]> {
  const pineconeIndex = await getPineconeIndex()

  const queryResponse = await pineconeIndex.query({
    queryRequest: {
      vector: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector for metadata-only query
      topK: 100,
      includeMetadata: true,
      filter: {
        user_id: { $eq: userId },
        record_type: { $eq: "document" },
      },
      namespace: "",
    },
  })

  return (queryResponse.matches || []).map((match) => ({
    id: match.id,
    name: match.metadata?.name || "Untitled",
    description: match.metadata?.description || "",
    file_type: match.metadata?.file_type || "UNKNOWN",
    file_size: match.metadata?.file_size || 0,
    file_path: match.metadata?.file_path || "",
    status: match.metadata?.status || "processing",
    processing_progress: match.metadata?.processing_progress || 0,
    error_message: match.metadata?.error_message || "",
    created_at: match.metadata?.created_at || new Date().toISOString(),
    updated_at: match.metadata?.updated_at || new Date().toISOString(),
    user_id: match.metadata?.user_id || "",
  })) as Document[]
}

/**
 * Gets a document by ID
 */
export async function getDocumentById(id: string): Promise<Document | null> {
  const pineconeIndex = await getPineconeIndex()

  const queryResponse = await pineconeIndex.query({
    queryRequest: {
      vector: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector for metadata-only query
      topK: 1,
      includeMetadata: true,
      filter: {
        id: { $eq: id },
        record_type: { $eq: "document" },
      },
      namespace: "",
    },
  })

  if (!queryResponse.matches || queryResponse.matches.length === 0) {
    return null
  }

  const match = queryResponse.matches[0]

  return {
    id: match.id,
    name: match.metadata?.name || "Untitled",
    description: match.metadata?.description || "",
    file_type: match.metadata?.file_type || "UNKNOWN",
    file_size: match.metadata?.file_size || 0,
    file_path: match.metadata?.file_path || "",
    status: match.metadata?.status || "processing",
    processing_progress: match.metadata?.processing_progress || 0,
    error_message: match.metadata?.error_message || "",
    created_at: match.metadata?.created_at || new Date().toISOString(),
    updated_at: match.metadata?.updated_at || new Date().toISOString(),
    user_id: match.metadata?.user_id || "",
  } as Document
}

/**
 * Updates a document's status
 */
export async function updateDocumentStatus(
  documentId: string,
  status: "processing" | "indexed" | "failed",
  progress: number,
  errorMessage?: string,
): Promise<Document> {
  const pineconeIndex = await getPineconeIndex()

  // Get current document
  const document = await getDocumentById(documentId)

  if (!document) {
    throw new Error("Document not found")
  }

  const updatedDocument = {
    ...document,
    status,
    processing_progress: progress,
    error_message: errorMessage || "",
    updated_at: new Date().toISOString(),
  }

  await pineconeIndex.upsert({
    upsertRequest: {
      vectors: [
        {
          id: documentId,
          values: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector
          metadata: {
            ...updatedDocument,
            record_type: "document",
          },
        },
      ],
      namespace: "",
    },
  })

  return updatedDocument
}

/**
 * Deletes a document and all its chunks
 */
export async function deleteDocument(id: string): Promise<void> {
  const pineconeIndex = await getPineconeIndex()

  // Delete the document
  await pineconeIndex.delete({
    deleteRequest: {
      ids: [id],
      namespace: "",
    },
  })

  // Find all chunks for this document
  const queryResponse = await pineconeIndex.query({
    queryRequest: {
      vector: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector for metadata-only query
      topK: 1000,
      includeMetadata: true,
      filter: {
        document_id: { $eq: id },
        record_type: { $eq: "chunk" },
      },
      namespace: "",
    },
  })

  // Delete all chunks
  if (queryResponse.matches && queryResponse.matches.length > 0) {
    const chunkIds = queryResponse.matches.map((match) => match.id)
    await pineconeIndex.delete({
      deleteRequest: {
        ids: chunkIds,
        namespace: "",
      },
    })
  }
}

/**
 * Uploads a file to storage (using Supabase for file storage only)
 */
export async function uploadFile(userId: string, file: File): Promise<{ path: string }> {
  const supabase = getSupabaseBrowserClient()

  const fileName = `${Date.now()}-${file.name}`
  const filePath = `${userId}/${fileName}`

  const { data, error } = await supabase.storage.from("documents").upload(filePath, file)

  if (error) {
    throw new Error(`File upload failed: ${error.message}`)
  }

  return { path: data.path }
}

/**
 * Gets a signed URL for a file
 */
export async function getFileSignedUrl(filePath: string): Promise<string> {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 3600) // 1 hour expiry

  if (error || !data?.signedUrl) {
    throw new Error("Failed to get file URL")
  }

  return data.signedUrl
}

/**
 * Processes a document: extracts text, chunks it, and stores embeddings
 */
export async function processDocument({
  documentId,
  userId,
  filePath,
  fileName,
  fileType,
  fileUrl,
}: ProcessDocumentOptions): Promise<boolean> {
  try {
    // Update document status to processing
    await updateDocumentStatus(documentId, "processing", 10)

    // 1. Extract text from document
    const text = await extractTextFromDocument(fileUrl, fileType)
    await updateDocumentStatus(documentId, "processing", 30)

    // 2. Split text into chunks
    const chunks = chunkText(text, {
      document_id: documentId,
      document_name: fileName,
      document_type: fileType,
      user_id: userId,
    })
    await updateDocumentStatus(documentId, "processing", 50)

    // 3. Generate embeddings and store in Pinecone
    await embedAndStoreChunks(chunks)
    await updateDocumentStatus(documentId, "processing", 90)

    // 4. Update document status to indexed
    await updateDocumentStatus(documentId, "indexed", 100)

    return true
  } catch (error) {
    console.error("Error processing document:", error)
    await updateDocumentStatus(
      documentId,
      "failed",
      0,
      error instanceof Error ? error.message : "Unknown error occurred",
    )
    return false
  }
}

// Private helper functions

/**
 * Extracts text from a document based on file type
 */
async function extractTextFromDocument(fileUrl: string, fileType: string): Promise<string> {
  try {
    // Fetch the file content
    const response = await fetch(fileUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`)
    }

    const data = await response.blob()

    // Convert file to text based on file type
    let text = ""

    switch (fileType.toLowerCase()) {
      case "txt":
        text = await data.text()
        break
      case "pdf":
        // In a real implementation, you would use a PDF parsing library
        text = await simulatePdfExtraction(data)
        break
      case "docx":
        // In a real implementation, you would use a DOCX parsing library
        text = await simulateDocxExtraction(data)
        break
      default:
        // For unsupported file types, extract what we can as plain text
        text = await data.text()
    }

    return text
  } catch (error) {
    console.error("Error extracting text:", error)
    throw error
  }
}

/**
 * Simulates PDF text extraction (placeholder)
 */
async function simulatePdfExtraction(file: Blob): Promise<string> {
  // This is a placeholder. In a real implementation, use a PDF parsing library
  return `This is simulated text extracted from a PDF file. 
  In a production environment, you would use a proper PDF parsing library.
  The content would include all the text from the PDF document.`
}

/**
 * Simulates DOCX text extraction (placeholder)
 */
async function simulateDocxExtraction(file: Blob): Promise<string> {
  // This is a placeholder. In a real implementation, use a DOCX parsing library
  return `This is simulated text extracted from a DOCX file. 
  In a production environment, you would use a proper DOCX parsing library.
  The content would include all the text from the DOCX document.`
}

/**
 * Splits text into chunks with metadata
 */
function chunkText(
  text: string,
  metadata: {
    document_id: string
    document_name: string
    document_type: string
    user_id: string
  },
  maxChunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_CHUNK_OVERLAP,
): DocumentChunk[] {
  const chunks: DocumentChunk[] = []

  // Split by headers first to preserve document structure
  const sections = splitByHeaders(text)

  let chunkIndex = 0

  for (const section of sections) {
    // If section is small enough, keep it as a single chunk
    if (section.content.length <= maxChunkSize) {
      chunks.push({
        id: uuidv4(),
        content: section.content.trim(),
        metadata: {
          ...metadata,
          index: chunkIndex++,
          section: section.header,
          record_type: "chunk",
          created_at: new Date().toISOString(),
        },
      })
      continue
    }

    // Otherwise, split the section into smaller chunks
    const sectionChunks = splitSectionIntoChunks(section.content, maxChunkSize, overlap)

    for (const chunk of sectionChunks) {
      chunks.push({
        id: uuidv4(),
        content: chunk.trim(),
        metadata: {
          ...metadata,
          index: chunkIndex++,
          section: section.header,
          record_type: "chunk",
          created_at: new Date().toISOString(),
        },
      })
    }
  }

  return chunks
}

/**
 * Splits text by headers to preserve document structure
 */
function splitByHeaders(text: string): { header?: string; content: string }[] {
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

/**
 * Splits a section into chunks with overlap
 */
function splitSectionIntoChunks(text: string, maxChunkSize: number, overlap: number): string[] {
  const chunks: string[] = []

  // Split by paragraphs first
  const paragraphs = text.split(/\n\s*\n/)

  let currentChunk = ""

  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the max size, store the current chunk and start a new one
    if (currentChunk.length + paragraph.length > maxChunkSize) {
      chunks.push(currentChunk.trim())

      // Start new chunk with overlap from the end of the previous chunk
      const words = currentChunk.split(/\s+/)
      const overlapWords = words.slice(-Math.floor(overlap / 5)) // Approximate words for overlap
      currentChunk = overlapWords.join(" ") + " " + paragraph
    } else {
      // Add paragraph to current chunk
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph
    }
  }

  // Add the last chunk if it's not empty
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

/**
 * Generates embeddings for chunks and stores them in Pinecone
 */
async function embedAndStoreChunks(chunks: DocumentChunk[]): Promise<void> {
  const pineconeIndex = await getPineconeIndex()

  // Process chunks in batches to avoid rate limits
  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE)

    // Generate embeddings for this batch
    const embeddingPromises = batch.map(async (chunk) => {
      try {
        const embedding = await generateEmbedding(chunk.content)

        return {
          id: chunk.id,
          values: embedding,
          metadata: {
            ...chunk.metadata,
            content: chunk.content,
          },
        }
      } catch (error) {
        console.error(`Error generating embedding for chunk ${chunk.id}:`, error)
        throw error
      }
    })

    const embeddings = await Promise.all(embeddingPromises)

    // Store embeddings in Pinecone
    await pineconeIndex.upsert({
      upsertRequest: {
        vectors: embeddings,
        namespace: "",
      },
    })
  }
}
