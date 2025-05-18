// Info: This file implements settings API endpoints using Pinecone for storage
import { NextResponse } from "next/server"
import { getPineconeIndex } from "@/lib/pinecone-client"
import { v4 as uuidv4 } from "uuid"

export async function GET(request: Request) {
  try {
    // Use Pinecone for settings storage
    const pineconeIndex = getPineconeIndex()

    // Query all settings
    const queryResponse = await pineconeIndex.query({
      vector: new Array(1536).fill(0), // Placeholder vector
      topK: 100,
      includeMetadata: true,
      filter: {
        record_type: { $eq: "setting" },
      },
    })

    // Convert array to object with key as the key
    const settings = queryResponse.matches.reduce(
      (acc, setting) => {
        if (setting.metadata?.key) {
          acc[setting.metadata.key as string] = setting.metadata.value
        }
        return acc
      },
      {} as Record<string, any>,
    )

    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { key, value, description } = await request.json()

    if (!key || value === undefined) {
      return NextResponse.json({ error: "Key and value are required" }, { status: 400 })
    }

    // Use Pinecone for settings storage
    const pineconeIndex = getPineconeIndex()

    // Check if setting exists
    const queryResponse = await pineconeIndex.query({
      vector: new Array(1536).fill(0), // Placeholder vector
      topK: 1,
      includeMetadata: true,
      filter: {
        key: { $eq: key },
        record_type: { $eq: "setting" },
      },
    })

    const existingData = queryResponse.matches.length > 0 ? queryResponse.matches[0] : null

    let settingId

    if (existingData) {
      // Update existing setting
      settingId = existingData.id

      await pineconeIndex.upsert([
        {
          id: settingId,
          values: new Array(1536).fill(0), // Placeholder vector
          metadata: {
            key,
            value,
            description: description || existingData.metadata?.description,
            record_type: "setting",
            updated_at: new Date().toISOString(),
          },
        },
      ])
    } else {
      // Create new setting
      settingId = uuidv4()

      await pineconeIndex.upsert([
        {
          id: settingId,
          values: new Array(1536).fill(0), // Placeholder vector
          metadata: {
            key,
            value,
            description,
            record_type: "setting",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
      ])
    }

    // Return the setting
    const setting = {
      id: settingId,
      key,
      value,
      description,
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({ setting })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
