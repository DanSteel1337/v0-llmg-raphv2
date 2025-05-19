/**
 * Handles file upload to server memory. Triggers vectorization via /process API after upload.
 */

import type { NextRequest } from "next/server"
import { uploadFile } from "@/services/document-service"
import { handleApiRequest } from "@/lib/api-utils"
import { withErrorHandling } from "@/lib/error-handler"

export const runtime = "edge"

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const userId = formData.get("userId") as string
    const documentId = formData.get("documentId") as string
    const filePath = formData.get("filePath") as string

    if (!file) {
      throw new Error("File is required")
    }

    if (!userId) {
      throw new Error("User ID is required")
    }

    if (!documentId) {
      throw new Error("Document ID is required")
    }

    if (!filePath) {
      throw new Error("File path is required")
    }

    const result = await uploadFile(userId, file)

    // Trigger document processing after successful upload
    try {
      const fileUrl = `${request.nextUrl.origin}/api/documents/file?path=${encodeURIComponent(filePath)}`

      await fetch(`${request.nextUrl.origin}/api/documents/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          userId,
          filePath,
          fileName: file.name,
          fileType: file.type,
          fileUrl,
        }),
      })
    } catch (error) {
      console.error("Error triggering document processing:", error)
      // We don't throw here to avoid failing the upload response
      // The client will still poll for document status
    }

    return result
  })
})
