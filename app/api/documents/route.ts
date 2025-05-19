import type { NextRequest } from "next/server"
import { withErrorHandling, handleApiRequest } from "@/utils/apiUtils"
import { getDocumentsByUserId } from "@/services/document-service"

// Function to get documents for a user
async function getDocumentsForUser(userId: string) {
  console.log(`GET /api/documents - Fetching documents for user: ${userId}`)

  try {
    // Call the document service to get documents
    const documents = await getDocumentsByUserId(userId)

    console.log(`GET /api/documents - Successfully fetched ${documents.length} documents for user: ${userId}`)
    return documents
  } catch (error) {
    console.error(`GET /api/documents - Error fetching documents for user: ${userId}`, {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    })
    throw error
  }
}

// POST handler for creating a document
export const POST = async (request: NextRequest) => {
  return withErrorHandling(async () => {
    return handleApiRequest(async () => {
      try {
        const body = await request.json()
        console.log(`POST /api/documents - Creating document`, {
          userId: body.userId,
          name: body.name,
        })

        // Existing POST implementation...
        // This is just a placeholder to show the existing handler
        return { document: { id: "new-doc", name: body.name, file_path: body.filePath } }
      } catch (error) {
        console.error("POST /api/documents - Error creating document", {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          url: request.url,
        })
        throw error
      }
    })
  })
}

// GET handler for fetching documents
export const GET = withErrorHandling(async (req: NextRequest) => {
  return handleApiRequest(async () => {
    const userId = req.nextUrl.searchParams.get("userId")
    if (!userId) throw new Error("Missing userId")

    const documents = await getDocumentsForUser(userId)
    return { documents }
  })
})
