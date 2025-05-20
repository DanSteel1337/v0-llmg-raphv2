/**
 * Blob Storage Client
 *
 * A client for interacting with Vercel Blob Storage.
 * Used for storing and retrieving document files.
 *
 * Dependencies:
 * - @vercel/blob for blob storage operations
 * - @/lib/utils/logger for structured logging
 */

import { put, list, del, type PutOptions, type ListBlobResult } from "@vercel/blob"
import { logger } from "./utils/logger"

/**
 * Upload a file to Blob Storage
 *
 * @param buffer - File content as Buffer or ReadableStream
 * @param filename - Name for the file in storage
 * @param options - Additional options for the put operation
 * @returns URL and other metadata for the uploaded file
 */
export async function uploadToBlob(buffer: Buffer | ReadableStream, filename: string, options?: PutOptions) {
  try {
    logger.info(`Uploading file to blob storage`, { filename })
    const result = await put(filename, buffer, options)
    logger.info(`File uploaded to blob storage successfully`, {
      filename,
      url: result.url,
      size: result.size,
    })
    return result
  } catch (error) {
    logger.error(`Error uploading file to blob storage`, {
      filename,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    throw error
  }
}

/**
 * List files in Blob Storage with optional prefix
 *
 * @param prefix - Optional prefix to filter files by
 * @returns List of blobs matching the prefix
 */
export async function listBlobFiles(prefix?: string): Promise<ListBlobResult> {
  try {
    logger.info(`Listing files in blob storage`, { prefix })
    const result = await list({ prefix })
    logger.info(`Listed ${result.blobs.length} files from blob storage`, { prefix })
    return result
  } catch (error) {
    logger.error(`Error listing files from blob storage`, {
      prefix,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    throw error
  }
}

/**
 * Delete a file from Blob Storage
 *
 * @param url - URL of the file to delete
 * @returns Whether the deletion was successful
 */
export async function deleteFromBlob(url: string): Promise<boolean> {
  try {
    logger.info(`Deleting file from blob storage`, { url })
    await del(url)
    logger.info(`File deleted from blob storage successfully`, { url })
    return true
  } catch (error) {
    logger.error(`Error deleting file from blob storage`, {
      url,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    throw error
  }
}
