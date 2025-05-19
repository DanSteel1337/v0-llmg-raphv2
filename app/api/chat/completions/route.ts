/**
 * Chat Completions API Route
 *
 * API endpoint for generating chat completions.
 *
 * Dependencies:
 * - openai for chat completions
 */

import OpenAI from "openai"

export const runtime = "edge"

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { messages, system, stream = false } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Missing or invalid 'messages' in request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Prepare messages array with system message if provided
    const messageArray = system ? [{ role: "system", content: system }, ...messages] : messages

    if (stream) {
      // Handle streaming response
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messageArray,
        stream: true,
      })

      return new Response(response.toReadableStream(), {
        headers: { "Content-Type": "text/event-stream" },
      })
    } else {
      // Handle non-streaming response
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messageArray,
      })

      return new Response(
        JSON.stringify({
          text: response.choices[0].message.content,
          usage: response.usage,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    }
  } catch (error) {
    console.error("Error generating chat completion:", error)
    return new Response(JSON.stringify({ error: "Failed to generate chat completion" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
