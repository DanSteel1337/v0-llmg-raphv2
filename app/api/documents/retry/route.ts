/**
 * Document Retry API Route
 *
 * Allows manual retrying of document processing for failed documents.
 * Validates document existence and status before triggering reprocessing.
 * 
 * IMPORTANT:
 * - ALWAYS declare runtime = "edge" for compatibility with Vercel Edge
 * - ALWAYS check document exists before attempting to retry
 * - NEVER retry documents that are already processing
 * - ALWAYS return { success: true/false } in responses
 * - Use background processing pattern to handle long-running tasks
 * 
 * Dependencies:
 * - @/lib/document-service for document operations
 * - @/lib/utils/logger for structured logging
 * 
 * @module app/api/documents/retry/route
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getDocumentById, processDocument } from "@/lib/document-service"
import { logger } from "@/lib/utils/logger"

export const runtime = "edge"

export async function POST(request: NextRequest) {
  try {
    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      logger.error("Failed to parse request body", { 
        error: parseError instanceof Error ? parseError.message : "Unknown error" 
      });
      
      return NextResponse.json(
        { success: false, error: "Invalid request body format - must be JSON" },
        { status: 400 }
      );
    }
    
    // Validate document ID - explicit check for existence and type
    if (!body.documentId) {
      logger.error("Missing documentId in retry request");
      
      return NextResponse.json(
        { success: false, error: "Document ID is required" },
        { status: 400 }
      );
    }
    
    const { documentId } = body;

    logger.info(`Retry requested for document: ${documentId}`);

    // Get document details with error handling
    let document;
    try {
      document = await getDocumentById(documentId);
    } catch (lookupError) {
      logger.error(`Error retrieving document for retry: ${documentId}`, {
        error: lookupError instanceof Error ? lookupError.message : "Unknown error" 
      });
      
      return NextResponse.json(
        { success: false, error: `Error retrieving document: ${lookupError instanceof Error ? lookupError.message : "Unknown error"}` },
        { status: 500 }
      );
    }

    // Check if document exists
    if (!document) {
      logger.error(`Document not found for retry: ${documentId}`);
      
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    // Check if document is already processing
    if (document.status === "processing") {
      logger.warn(`Document is already processing: ${documentId}`);
      
      return NextResponse.json(
        {
          success: false,
          error: "Document is already being processed",
          status: document.status,
          progress: document.processing_progress,
        },
        { status: 409 }
      );
    }

    // Check if document has required fields for processing
    if (!document.file_path || !document.name) {
      logger.error(`Document missing required fields for retry: ${documentId}`);
      
      return NextResponse.json(
        {
          success: false,
          error: "Document is missing required fields for processing",
          document: {
            id: document.id,
            name: document.name,
            file_path: document.file_path,
          },
        },
        { status: 400 }
      );
    }

    // Construct file URL from file path
    // This assumes file_path contains the full path to the file
    const fileUrl = document.file_path.startsWith("http")
      ? document.file_path
      : `${request.nextUrl.origin}${document.file_path}`;

    logger.info(`Retrying document processing`, {
      documentId,
      previousStatus: document.status,
      fileName: document.name,
      fileUrl,
    });

    // Trigger document processing - wrap in try/catch
    try {
      // We're not awaiting this to avoid timeout issues
      processDocument({
        documentId: document.id,
        userId: document.user_id,
        filePath: document.file_path,
        fileName: document.name,
        fileType: document.file_type,
        fileUrl,
        isRetry: true,
      }).catch((error) => {
        logger.error(`Error in background document processing: ${error instanceof Error ? error.message : "Unknown error"}`, {
          documentId,
          stack: error instanceof Error ? error.stack : String(error),
        });
      });
      
      // Return success response ALWAYS with success: true flag
      return NextResponse.json(
        {
          success: true,
          message: "Document processing retry initiated",
          documentId: document.id,
          previousStatus: document.status,
        },
        { status: 200 }
      );
    } catch (error) {
      logger.error(`Error initiating retry process: ${error instanceof Error ? error.message : "Unknown error"}`, {
        documentId,
        stack: error instanceof Error ? error.stack : String(error),
      });
      
      return NextResponse.json(
        {
          success: false,
          error: `Failed to start retry: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error(`Error in retry API route: ${error instanceof Error ? error.message : "Unknown error"}`);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred",
      },
      {
        status: 500,
      }
    );
  }
}
