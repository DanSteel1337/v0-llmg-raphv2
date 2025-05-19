/**
 * Document Upload API Route
 *
 * API endpoint for uploading document files.
 *
 * Dependencies:
 * - @/services/document-service for file upload operations
 * - @/lib/api-utils for API response handling
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

    if (!file) {
      throw new Error("File is required")
    }

    if (!userId) {
      throw new Error("User ID is required")
    }

    const result = await uploadFile(userId, file)
    return result
  })
})
