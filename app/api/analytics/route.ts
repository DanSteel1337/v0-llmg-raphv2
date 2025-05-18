// Info: This file implements analytics API endpoints using Pinecone for storage
import { NextResponse } from "next/server"
import { getPineconeIndex } from "@/lib/pinecone-client"
import { v4 as uuidv4 } from "uuid"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const timeRange = searchParams.get("timeRange") || "week"

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Use Pinecone for analytics data
    const pineconeIndex = getPineconeIndex()

    // Calculate date range
    const now = new Date()
    const startDate = new Date()

    switch (timeRange) {
      case "day":
        startDate.setDate(now.getDate() - 1)
        break
      case "week":
        startDate.setDate(now.getDate() - 7)
        break
      case "month":
        startDate.setMonth(now.getMonth() - 1)
        break
      case "quarter":
        startDate.setMonth(now.getMonth() - 3)
        break
      case "year":
        startDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        startDate.setDate(now.getDate() - 7)
    }

    const startDateStr = startDate.toISOString()

    // Get document count
    const documentResponse = await pineconeIndex.query({
      vector: new Array(1536).fill(0), // Placeholder vector
      topK: 0, // We only need the count
      includeMetadata: false,
      filter: {
        user_id: { $eq: userId },
        record_type: { $eq: "document" },
      },
    })

    const documentCount = documentResponse.matches.length

    // Get search count
    const searchResponse = await pineconeIndex.query({
      vector: new Array(1536).fill(0), // Placeholder vector
      topK: 0, // We only need the count
      includeMetadata: false,
      filter: {
        user_id: { $eq: userId },
        record_type: { $eq: "search_history" },
        created_at: { $gte: startDateStr },
      },
    })

    const searchCount = searchResponse.matches.length

    // Get chat message count
    const chatResponse = await pineconeIndex.query({
      vector: new Array(1536).fill(0), // Placeholder vector
      topK: 0, // We only need the count
      includeMetadata: false,
      filter: {
        user_id: { $eq: userId },
        record_type: { $eq: "message" },
        role: { $eq: "user" },
        created_at: { $gte: startDateStr },
      },
    })

    const chatCount = chatResponse.matches.length

    // Use sample data for now since we don't have real data yet
    const documentTypes = [
      { name: "PDF", value: 45 },
      { name: "DOCX", value: 30 },
      { name: "TXT", value: 15 },
      { name: "CSV", value: 5 },
      { name: "XLSX", value: 5 },
    ]

    const searchUsage = [
      { date: "2023-01", count: 120 },
      { date: "2023-02", count: 150 },
      { date: "2023-03", count: 180 },
      { date: "2023-04", count: 220 },
      { date: "2023-05", count: 250 },
      { date: "2023-06", count: 280 },
      { date: "2023-07", count: 310 },
      { date: "2023-08", count: 340 },
      { date: "2023-09", count: 370 },
      { date: "2023-10", count: 400 },
      { date: "2023-11", count: 430 },
      { date: "2023-12", count: 460 },
    ]

    const userActivity = [
      { date: "Mon", searches: 65, chats: 40 },
      { date: "Tue", searches: 80, chats: 55 },
      { date: "Wed", searches: 95, chats: 70 },
      { date: "Thu", searches: 85, chats: 60 },
      { date: "Fri", searches: 75, chats: 50 },
      { date: "Sat", searches: 45, chats: 30 },
      { date: "Sun", searches: 35, chats: 25 },
    ]

    // Sample performance data
    const performance = {
      search_latency: 250,
      indexing_speed: 85,
      chat_response: 320,
      document_processing: 450,
    }

    return NextResponse.json({
      documentCount,
      searchCount,
      chatCount,
      documentTypes,
      searchUsage,
      userActivity,
      performance,
    })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { eventType, eventData, userId } = await request.json()

    if (!eventType || !eventData) {
      return NextResponse.json({ error: "Event type and data are required" }, { status: 400 })
    }

    // Use Pinecone for analytics events
    const pineconeIndex = getPineconeIndex()

    const eventId = uuidv4()

    await pineconeIndex.upsert([
      {
        id: eventId,
        values: new Array(1536).fill(0), // Placeholder vector
        metadata: {
          event_type: eventType,
          event_data: JSON.stringify(eventData),
          user_id: userId,
          record_type: "analytics_event",
          created_at: new Date().toISOString(),
        },
      },
    ])

    return NextResponse.json({
      success: true,
      event: {
        id: eventId,
        event_type: eventType,
        event_data: eventData,
        user_id: userId,
        created_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
