/**
 * Embeddings API Route
 *
 * API endpoint for generating text embeddings.
 *
 * Dependencies:
 * - openai for embedding generation
 */

import { NextResponse } from "next/server"
import OpenAI from "openai"

export const runtime = "edge"

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { text, texts } = await request.json()

    if (texts && Array.isArray(texts)) {
      // Handle batch embedding
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: texts,
      })

      return NextResponse.json({
        embeddings: response.data.map((item) => item.embedding),
      })
    } else if (text) {
      // Handle single text embedding
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      })

      return NextResponse.json({
        embedding: response.data[0].embedding,
      })
    } else {
      return NextResponse.json({ error: "Missing 'text' or 'texts' in request body" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error generating embeddings:", error)
    return NextResponse.json({ error: "Failed to generate embeddings" }, { status: 500 })
  }
}
