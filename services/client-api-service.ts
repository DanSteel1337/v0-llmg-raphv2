/**
 * Client API Service
 *
 * Client-side abstraction for API calls to handle document management, search,
 * chat, and analytics operations. Provides a clean interface for all API
 * interactions used by React components and hooks.
 *
 * Features:
 * - Document upload and management
 * - Search functionality
 * - Chat and conversation handling
 * - Analytics and system health checks
 * - Standardized error handling
 * 
 * Dependencies:
 * - ./apiCall for standardized API request formatting
 * - @/types for type definitions
 * 
 * @module services/client-api-service
 */

import { apiCall } from "./apiCall"
import type { Document, AnalyticsData, Conversation, Message, SearchResult } from "@/types"

/**
 * Fetch documents for a user
 * 
 * @param userId - The user's unique identifier
 * @returns Array of document metadata objects
 */
export async function fetchDocuments(userId: string): Promise<Document[]> {
  try {
    if (!userId) {
      console.error("fetchDocuments called without userId");
      return [];
    }
    
    console.log(`Fetching documents for user ${userId}`);
    const response = await apiCall<{ documents: Document[] }>(`/api/documents?userId=${encodeURIComponent(userId)}`);
    
    if (!response || !response.documents) {
      console.warn("Received invalid response from documents API", { response });
      return [];
    }
    
    return Array.isArray(response.documents) ? response.documents : [];
  } catch (error) {
    console.error("Error fetching documents:", error);
    throw error;
  }
}

/**
 * Upload a document to the system
 * Implements a three-step process:
 * 1. Create document metadata
 * 2. Upload file content
 * 3. Trigger processing pipeline
 * 
 * @param userId - User ID for document ownership
 * @param file - File object to upload
 * @param onProgress - Optional progress callback for monitoring
 * @returns Document metadata object
 */
export async function uploadDocument(
  userId: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<Document> {
  try {
    // Validate inputs
    if (!userId) throw new Error("User ID is required");
    if (!file) throw new Error("File is required");
    
    // Step 1: Create document metadata
    console.log("Creating document metadata...", {
      userId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });

    const createResponse = await apiCall<{ document: Document }>("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        name: file.name,
        fileType: file.type || "text/plain",
        fileSize: file.size,
        filePath: `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
      }),
    });

    // Validate document response
    const document = createResponse?.document;
    if (!document?.id || !document?.file_path) {
      console.error("Document creation failed - missing fields:", document);
      throw new Error("Document creation failed: Missing document ID or file path");
    }

    console.log("Document metadata created successfully:", {
      documentId: document.id,
      filePath: document.file_path,
    });

    // Step 2: Upload the file content
    console.log("Uploading file content...", {
      documentId: document.id,
      filePath: document.file_path,
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userId);
    formData.append("documentId", document.id);
    formData.append("filePath", document.file_path);

    const uploadResponse = await apiCall<{ success: boolean; fileUrl: string }>("/api/documents/upload", {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse?.success) {
      console.error("File upload failed:", uploadResponse);
      throw new Error("File upload failed");
    }

    const fileUrl = uploadResponse.fileUrl || `/api/documents/file?path=${encodeURIComponent(document.file_path)}`;

    console.log("File uploaded successfully:", {
      documentId: document.id,
      filePath: document.file_path,
      fileUrl,
    });

    // Step 3: Process the document
    console.log("Triggering document processing...", {
      documentId: document.id,
      filePath: document.file_path,
      fileUrl,
    });

    try {
      const processResponse = await apiCall<{ success?: boolean; status?: string; message?: string; error?: string }>(
        "/api/documents/process",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: document.id,
            userId,
            filePath: document.file_path,
            fileName: file.name,
            fileType: file.type || "text/plain",
            fileUrl,
          }),
        },
      );

      // Log the full response for debugging
      console.log("Document processing response:", processResponse);

      // IMPROVED: Better error handling for response validation
      if (!processResponse || processResponse.success !== true) {
        const errorMessage = processResponse?.error || "Unknown error";
        console.error("Document processing failed to start:", { error: errorMessage, response: processResponse });
        throw new Error(`Failed to start document processing: ${errorMessage}`);
      }

      console.log("Document processing triggered:", {
        documentId: document.id,
        filePath: document.file_path,
        fileUrl,
        status: processResponse.status || "processing",
      });
    } catch (processError) {
      console.error("Error triggering document processing:", processError);
      throw new Error(
        `Failed to start document processing: ${
          processError instanceof Error ? processError.message : "Unknown error"
        }`,
      );
    }

    // Poll for document status updates if progress callback provided
    if (onProgress) {
      const pollInterval = setInterval(async () => {
        try {
          const documents = await fetchDocuments(userId);
          const updatedDocument = documents.find((d) => d.id === document.id);

          if (updatedDocument) {
            if (updatedDocument.status === "indexed" || updatedDocument.status === "failed") {
              clearInterval(pollInterval);
              onProgress(updatedDocument.status === "indexed" ? 100 : 0);
              console.log("Document processing completed:", {
                documentId: document.id,
                status: updatedDocument.status,
                message: updatedDocument.error_message || "Success",
              });
            } else if (updatedDocument.processing_progress !== undefined) {
              onProgress(updatedDocument.processing_progress);
              console.log("Document processing progress:", {
                documentId: document.id,
                progress: updatedDocument.processing_progress,
              });
            }
          }
        } catch (error) {
          console.error("Error polling document status:", error);
        }
      }, 2000);

      // Clean up interval after 5 minutes (max processing time)
      setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
    }

    return document;
  } catch (error) {
    console.error("Document upload pipeline failed:", error);
    throw error;
  }
}

/**
 * Delete a document from the system
 * 
 * @param documentId - Document ID to delete
 * @returns Success response
 */
export async function deleteDocument(documentId: string): Promise<{ success: boolean }> {
  if (!documentId) {
    console.error("deleteDocument called without documentId");
    throw new Error("Document ID is required");
  }
  
  return await apiCall<{ success: boolean }>(`/api/documents/${encodeURIComponent(documentId)}`, {
    method: "DELETE",
  });
}

/**
 * Fetch analytics data for a user
 * 
 * @param userId - User ID for analytics
 * @param timeRange - Optional time range filter
 * @returns Analytics data object
 */
export async function fetchAnalytics(userId: string, timeRange = "7d"): Promise<AnalyticsData> {
  if (!userId) {
    console.error("fetchAnalytics called without userId");
    throw new Error("User ID is required");
  }
  
  return await apiCall<AnalyticsData>(`/api/analytics?userId=${encodeURIComponent(userId)}&timeRange=${encodeURIComponent(timeRange)}`);
}

/**
 * Check API health status for services
 * 
 * @returns Health status object with detailed error information
 */
export async function checkApiHealth(): Promise<{
  pineconeApiHealthy: boolean;
  openaiApiHealthy: boolean;
  errors?: {
    pinecone?: string | null;
    openai?: string | null;
  };
}> {
  try {
    const response = await apiCall<{
      status: string;
      services: Record<string, boolean>;
      errors?: {
        pinecone?: string | null;
        openai?: string | null;
      };
    }>("/api/health");

    // Log the full response for debugging
    console.log("Health check response:", response);

    return {
      pineconeApiHealthy: response?.services?.pinecone || false,
      openaiApiHealthy: response?.services?.openai || false,
      errors: response?.errors || {},
    };
  } catch (error) {
    // Log the error for debugging
    console.error("Error checking API health:", error);

    // Return detailed error information
    return {
      pineconeApiHealthy: false,
      openaiApiHealthy: false,
      errors: {
        pinecone: error instanceof Error ? error.message : "Failed to connect to health check endpoint",
        openai: error instanceof Error ? error.message : "Failed to connect to health check endpoint",
      },
    };
  }
}

/**
 * Fetch conversations for a user
 * 
 * @param userId - User ID
 * @returns Array of conversation objects
 */
export async function fetchConversations(userId: string): Promise<Conversation[]> {
  if (!userId) {
    console.error("fetchConversations called without userId");
    return [];
  }
  
  try {
    const response = await apiCall<{ conversations: Conversation[] }>(`/api/conversations?userId=${encodeURIComponent(userId)}`);
    return Array.isArray(response.conversations) ? response.conversations : [];
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return [];
  }
}

/**
 * Create a new conversation
 * 
 * @param userId - User ID
 * @param title - Conversation title
 * @returns New conversation object
 */
export async function createConversation(userId: string, title: string): Promise<Conversation> {
  if (!userId) throw new Error("User ID is required");
  if (!title) title = "New Conversation";
  
  const response = await apiCall<{ conversation: Conversation }>("/api/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, title }),
  });

  if (!response?.conversation?.id) {
    console.error("Invalid response from createConversation:", response);
    throw new Error("Failed to create conversation: Invalid response from server");
  }

  return response.conversation;
}

/**
 * Fetch messages for a conversation
 * 
 * @param conversationId - Conversation ID
 * @returns Array of message objects
 */
export async function fetchMessages(conversationId: string): Promise<Message[]> {
  if (!conversationId) {
    console.error("fetchMessages called without conversationId");
    return [];
  }
  
  try {
    const response = await apiCall<{ messages: Message[] }>(
      `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`
    );
    
    return Array.isArray(response?.messages) ? response.messages : [];
  } catch (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
}

/**
 * Send a message in a conversation
 * 
 * @param conversationId - Conversation ID
 * @param content - Message content
 * @param userId - User ID
 * @returns Created message object
 */
export async function sendMessage(conversationId: string, content: string, userId: string): Promise<Message> {
  // Enhanced validation
  if (!conversationId) throw new Error("Conversation ID is required");
  
  if (!content || typeof content !== 'string' || content.trim() === "") {
    throw new Error("Message content cannot be empty");
  }
  
  if (!userId) throw new Error("User ID is required");
  
  const requestBody = { conversationId, content, userId };
  console.log("Sending message:", { 
    conversationId, 
    contentLength: content.length, 
    userId 
  });
  
  try {
    const response = await apiCall<{ message: Message }>("/api/chat/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response?.message) {
      console.error("Invalid response from sendMessage:", response);
      throw new Error("Failed to send message: Invalid response from server");
    }

    return response.message;
  } catch (error) {
    // Enhanced error logging
    console.error("Error sending chat message:", {
      error: error instanceof Error ? error.message : "Unknown error",
      conversationId,
      contentLength: content.length,
      userId
    });
    throw error;
  }
}

/**
 * Perform search across documents
 * 
 * @param userId - User ID for context
 * @param query - Search query text
 * @param options - Search options including type and filters
 * @returns Search results array
 */
export async function performSearch(
  userId: string,
  query: string,
  options: {
    type?: "semantic" | "keyword" | "hybrid";
    documentTypes?: string[];
    sortBy?: string;
    dateRange?: { from?: string; to?: string };
  } = {},
): Promise<SearchResult[]> {
  if (!userId) throw new Error("User ID is required");
  if (!query || query.trim() === "") throw new Error("Search query cannot be empty");
  
  // Build query string
  let url = `/api/search?userId=${encodeURIComponent(userId)}&q=${encodeURIComponent(query)}`;

  // Add search type
  if (options.type) {
    url += `&type=${encodeURIComponent(options.type)}`;
  }

  // Add document type filters if any
  if (options.documentTypes && options.documentTypes.length > 0) {
    options.documentTypes.forEach((type) => {
      url += `&documentType=${encodeURIComponent(type)}`;
    });
  }

  // Add sort option if specified
  if (options.sortBy) {
    url += `&sortBy=${encodeURIComponent(options.sortBy)}`;
  }

  // Add date range if specified
  if (options.dateRange) {
    if (options.dateRange.from) {
      url += `&from=${encodeURIComponent(options.dateRange.from)}`;
    }
    if (options.dateRange.to) {
      url += `&to=${encodeURIComponent(options.dateRange.to)}`;
    }
  }

  try {
    // Execute search
    const response = await apiCall<{ results: SearchResult[] }>(url);
    return Array.isArray(response?.results) ? response.results : [];
  } catch (error) {
    console.error("Error performing search:", error);
    throw error;
  }
}
