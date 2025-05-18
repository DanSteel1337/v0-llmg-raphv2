// Info: This file implements document ID-specific API endpoints using Pinecone for storage
import { NextResponse } from "next/server"
import { getPineconeIndex } from "@/lib/pinecone-client"

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    if (!id) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
    }

    // Use Pinecone for document storage
    const pineconeIndex = getPineconeIndex()

    // Delete the document from Pinecone
    await pineconeIndex.deleteOne(id)

    // Also delete any chunks associated with this document
    // This would require a separate query to find all chunks with this document_id
    const queryResponse = await pineconeIndex.query({
      vector: [], // Empty vector for metadata-only query
      topK: 1000,
      includeMetadata: true,
      filter: {
        document_id: { $eq: id },
        record_type: { $eq: "chunk" },
      },
    })

    // Delete all chunks
    if (queryResponse.matches.length > 0) {
      const chunkIds = queryResponse.matches.map((match) => match.id)
      await pineconeIndex.deleteMany(chunkIds)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const { status, processing_progress, error_message } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
    }

    // Use Pinecone for document storage
    const pineconeIndex = getPineconeIndex()

    // First, get the current document to preserve existing metadata
    const queryResponse = await pineconeIndex.query({
      vector: [], // Empty vector for metadata-only query
      topK: 1,
      includeMetadata: true,
      filter: {
        id: { $eq: id },
      },
    })

    if (queryResponse.matches.length === 0) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const existingMetadata = queryResponse.matches[0].metadata || {}

    // Update the document in Pinecone
    await pineconeIndex.upsert([
      {
        id,
        values: new Array(1536).fill(0), // Placeholder vector (required by Pinecone)
        metadata: {
          ...existingMetadata,
          status,
          processing_progress,
          error_message,
          updated_at: new Date().toISOString(),
        },
      },
    ])

    // Return the updated document
    const document = {
      id,
      ...existingMetadata,
      status,
      processing_progress,
      error_message,
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({ document })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
