// Info: This file implements document API endpoints using Pinecone for storage and Vercel Blob for files
import { NextResponse } from "next/server"
import { getPineconeIndex } from "@/lib/pinecone-client"
import { v4 as uuidv4 } from "uuid"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Use Pinecone for document metadata storage
    const pineconeIndex = getPineconeIndex()

    // Query documents for this user
    const queryResponse = await pineconeIndex.query({
      vector: [], // Empty vector for metadata-only query
      topK: 100,
      includeMetadata: true,
      filter: {
        user_id: { $eq: userId },
        record_type: { $eq: "document" },
      },
    })

    // Format the documents from Pinecone
    const documents = queryResponse.matches.map((match) => ({
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
    }))

    return NextResponse.json({ documents })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId, name, description, fileType, fileSize, filePath } = await request.json()

    if (!userId || !name || !fileType || !fileSize || !filePath) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Use Pinecone for document metadata storage
    const pineconeIndex = getPineconeIndex()

    // Generate a unique ID for the document
    const documentId = uuidv4()

    // Create document metadata in Pinecone
    await pineconeIndex.upsert([
      {
        id: documentId,
        values: new Array(1536).fill(0), // Placeholder vector (required by Pinecone)
        metadata: {
          user_id: userId,
          name,
          description,
          file_type: fileType,
          file_size: fileSize,
          file_path: filePath,
          status: "processing",
          processing_progress: 0,
          record_type: "document", // Identify this as a document record
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    ])

    // Return the created document
    const document = {
      id: documentId,
      user_id: userId,
      name,
      description,
      file_type: fileType,
      file_size: fileSize,
      file_path: filePath,
      status: "processing",
      processing_progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({ document })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
