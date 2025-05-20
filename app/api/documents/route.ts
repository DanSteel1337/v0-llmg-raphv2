import { withErrorHandling } from "@/utils/errorHandling"
import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { validateRequiredFields } from "@/utils/validation"
import { createDocument } from "@/services/documents"

// Existing code...

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const body = await request.json()
      console.log(`POST /api/documents - Creating document`, {
        userId: body.userId,
        name: body.name,
      })

      validateRequiredFields(body, ["userId", "name", "fileType", "fileSize", "filePath"])
      const { userId, name, description, fileType, fileSize, filePath } = body

      const document = await createDocument(userId, name, description, fileType, fileSize, filePath)

      // Validate document before proceeding
      if (!document?.id || typeof document.id !== "string") {
        console.error("POST /api/documents - Invalid document response", { document })
        throw new Error("Failed to create document: Invalid document format")
      }

      console.log(`POST /api/documents - Successfully created document`, {
        userId,
        documentId: document.id,
        filePath: document.file_path,
      })

      // Return the document object with a 200 status
      return { document }
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
