import { withErrorHandling, handleApiRequest, validateRequiredFields, createDocument } from "@/utils/apiUtils"
import type { NextRequest } from "next/server"

export const POST = async (request: NextRequest) => {
  return withErrorHandling(async () => {
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
        })

        // Immediately trigger document processing
        try {
          const processResponse = await fetch(`${request.nextUrl.origin}/api/documents/process`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              documentId: document.id,
              userId,
              filePath,
              fileName: name,
              fileType,
              fileUrl: `${request.nextUrl.origin}/api/documents/file?path=${encodeURIComponent(filePath)}`,
            }),
          })

          if (!processResponse.ok) {
            const errorData = await processResponse.json().catch(() => ({}))
            console.error(`POST /api/documents - Failed to trigger document processing`, {
              documentId: document.id,
              status: processResponse.status,
              error: errorData.error || processResponse.statusText,
            })
          } else {
            console.log(`POST /api/documents - Successfully triggered document processing`, {
              documentId: document.id,
            })
          }
        } catch (processError) {
          console.error(`POST /api/documents - Error triggering document processing`, {
            documentId: document.id,
            error: processError instanceof Error ? processError.message : "Unknown error",
          })
          // We don't throw here to avoid failing the document creation
        }

        // Always return the document object
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
}
