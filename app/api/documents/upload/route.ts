import { withErrorHandling, uploadFile, type NextRequest, type File } from "your-module-path"

export const POST = async (request: NextRequest) => {
  return withErrorHandling(async () => {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const userId = formData.get("userId") as string
    const documentId = formData.get("documentId") as string
    const filePath = formData.get("filePath") as string

    console.log(`POST /api/documents/upload - Uploading file`, {
      documentId,
      userId,
      filePath,
      fileName: file?.name,
      fileSize: file?.size,
    })

    // Validate all required fields
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

    // Upload and persist the file
    const result = await uploadFile(userId, file, documentId, filePath)

    console.log(`POST /api/documents/upload - File uploaded successfully`, {
      documentId,
      filePath,
      success: result.success,
    })

    return {
      success: true,
      documentId,
      filePath,
    }
  })
}
