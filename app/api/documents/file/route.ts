// app/api/documents/file/route.ts

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { withErrorHandling } from "@/utils/errorHandling"
import { logger } from "@/lib/utils/logger"
import { getBlob } from "@vercel/blob"

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get("path")
  const blobUrl = searchParams.get("url")

  if (!path && !blobUrl) {
    logger.error("Document file request missing both path and url parameters")
    return NextResponse.json({ error: "Either path or url parameter is required" }, { status: 400 })
  }

  try {
    // If a direct blob URL is provided, redirect to it
    if (blobUrl) {
      logger.info(`GET /api/documents/file - Redirecting to blob URL`, { blobUrl })
      return NextResponse.redirect(blobUrl)
    }

    // For path-based requests, try to get the blob
    if (path) {
      logger.info(`GET /api/documents/file - Retrieving document file by path`, { path })

      // Check if this is a blob path (starts with documents/)
      if (path.startsWith("documents/")) {
        try {
          // Try to get the blob directly
          const blob = await getBlob(path)

          if (blob) {
            logger.info(`GET /api/documents/file - Redirecting to blob URL for path`, {
              path,
              blobUrl: blob.url,
            })
            return NextResponse.redirect(blob.url)
          }
        } catch (blobError) {
          logger.warn(`GET /api/documents/file - Error retrieving blob, trying to fetch content directly`, {
            path,
            error: blobError instanceof Error ? blobError.message : "Unknown error",
          })

          // If we can't get a blob URL, try to fetch the content directly
          try {
            // Try to fetch the file directly - this will work for paths that are actually URLs
            const response = await fetch(path)
            if (response.ok) {
              const contentType = response.headers.get("Content-Type") || "text/plain"
              const content = await response.text()

              return new NextResponse(content, {
                headers: {
                  "Content-Type": contentType,
                },
              })
            }
          } catch (fetchError) {
            logger.error(`GET /api/documents/file - Error fetching file content directly`, {
              path,
              error: fetchError instanceof Error ? fetchError.message : "Unknown error",
            })
          }
        }
      }

      // If we couldn't get the blob, see if path is a URL and try to fetch it
      if (path.startsWith("http")) {
        try {
          const response = await fetch(path)
          if (response.ok) {
            const contentType = response.headers.get("Content-Type") || "text/plain"
            const content = await response.text()

            return new NextResponse(content, {
              headers: {
                "Content-Type": contentType,
              },
            })
          }
        } catch (fetchError) {
          logger.error(`GET /api/documents/file - Error fetching file from URL`, {
            path,
            error: fetchError instanceof Error ? fetchError.message : "Unknown error",
          })
        }
      }

      // If we get here, we couldn't retrieve the file - return a fallback message
      logger.info(`GET /api/documents/file - Returning fallback content`, { path })

      return new NextResponse(`# Could not retrieve file: ${path}\n\nThe file could not be found or accessed.`, {
        headers: {
          "Content-Type": "text/plain",
        },
      })
    }

    // Should never reach here due to the initial check, but just in case
    return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 })
  } catch (error) {
    logger.error(`GET /api/documents/file - Error retrieving document file`, {
      path,
      blobUrl,
      error: error instanceof Error ? error.message : "Unknown error",
    })

    return NextResponse.json(
      {
        error: "Failed to retrieve document file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
})
