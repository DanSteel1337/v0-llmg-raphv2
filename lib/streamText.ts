/**
 * Text Streaming Utilities
 *
 * Provides utilities for handling text streaming in the application.
 *
 * @module lib/streamText
 */

/**
 * Stream text from a response
 *
 * @param response Fetch response object
 * @param onChunk Callback for each text chunk
 * @param onDone Callback when streaming is complete
 * @param onError Callback for errors
 */
export async function streamText(
  response: Response,
  onChunk: (chunk: string) => void,
  onDone?: () => void,
  onError?: (error: Error) => void,
): Promise<void> {
  try {
    // Check if response is valid
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Stream error (${response.status}): ${errorText}`)
    }

    // Check if response body is available
    if (!response.body) {
      throw new Error("Response body is not readable")
    }

    // Get reader from response body
    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    // Read chunks
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        onDone?.()
        break
      }

      // Decode and process chunk
      const chunk = decoder.decode(value, { stream: true })
      onChunk(chunk)
    }
  } catch (error) {
    console.error("Error streaming text:", error)
    onError?.(error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * Creates a readable stream from a text response
 * @param response - Fetch response
 * @returns Async generator yielding text chunks
 */
export async function* streamTextFromResponse(response: Response): AsyncGenerator<string, void, unknown> {
  if (!response.body) {
    throw new Error("Response body is null")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      const chunk = decoder.decode(value, { stream: true })
      yield chunk
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Parses a stream of JSON objects
 * @param stream - Async iterable of text chunks
 * @returns Async generator yielding parsed JSON objects
 */
export async function* parseJsonStream<T>(stream: AsyncIterable<string>): AsyncGenerator<T, void, unknown> {
  let buffer = ""

  for await (const chunk of stream) {
    buffer += chunk

    // Process complete JSON objects
    let startIndex = 0
    let endIndex

    while ((endIndex = buffer.indexOf("\n", startIndex)) !== -1) {
      const jsonString = buffer.substring(startIndex, endIndex).trim()
      startIndex = endIndex + 1

      if (jsonString) {
        try {
          const parsedData = JSON.parse(jsonString) as T
          yield parsedData
        } catch (error) {
          console.error("Error parsing JSON:", error)
        }
      }
    }

    // Keep the remaining partial data
    buffer = buffer.substring(startIndex)
  }

  // Process any remaining data
  if (buffer.trim()) {
    try {
      const parsedData = JSON.parse(buffer.trim()) as T
      yield parsedData
    } catch (error) {
      console.error("Error parsing JSON:", error)
    }
  }
}

/**
 * Creates a readable stream from a text string
 * @param text - Text to stream
 * @param chunkSize - Size of each chunk
 * @param delayMs - Delay between chunks in milliseconds
 * @returns Readable stream
 */
export function createTextStream(text: string, chunkSize = 10, delayMs = 10): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream({
    start(controller) {
      let index = 0

      function push() {
        if (index >= text.length) {
          controller.close()
          return
        }

        const chunk = text.slice(index, index + chunkSize)
        controller.enqueue(encoder.encode(chunk))
        index += chunkSize

        setTimeout(push, delayMs)
      }

      push()
    },
  })
}

/**
 * Consumes a text stream and calls a callback for each chunk
 * @param stream - Readable stream
 * @param onChunk - Callback for each chunk
 * @param onDone - Callback when stream is done
 * @param onError - Callback for errors
 */
export async function consumeTextStream(
  stream: ReadableStream<Uint8Array>,
  onChunk: (chunk: string) => void,
  onDone?: () => void,
  onError?: (error: Error) => void,
): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        onDone?.()
        break
      }

      const chunk = decoder.decode(value, { stream: true })
      onChunk(chunk)
    }
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)))
  } finally {
    reader.releaseLock()
  }
}
