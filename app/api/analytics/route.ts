import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-client"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const timeRange = searchParams.get("timeRange") || "week"

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

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

    // Get document count
    const { count: documentCount, error: documentError } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)

    if (documentError) {
      console.error("Error counting documents:", documentError)
      return NextResponse.json({ error: "Failed to count documents" }, { status: 500 })
    }

    // Get search count
    const { count: searchCount, error: searchError } = await supabase
      .from("search_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString())

    if (searchError) {
      console.error("Error counting searches:", searchError)
      return NextResponse.json({ error: "Failed to count searches" }, { status: 500 })
    }

    // Get chat message count
    const { count: chatCount, error: chatError } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("role", "user")
      .in("conversation_id", supabase.from("chat_conversations").select("id").eq("user_id", userId))
      .gte("created_at", startDate.toISOString())

    if (chatError) {
      console.error("Error counting chat messages:", chatError)
      return NextResponse.json({ error: "Failed to count chat messages" }, { status: 500 })
    }

    // Get document types distribution
    const { data: documentTypes, error: typesError } = await supabase.rpc("get_document_type_distribution", {
      user_id_param: userId,
    })

    if (typesError) {
      console.error("Error getting document types:", typesError)
      // Continue with other metrics
    }

    // Get search usage over time
    const { data: searchUsage, error: usageError } = await supabase.rpc("get_search_usage_over_time", {
      user_id_param: userId,
      start_date_param: startDate.toISOString(),
    })

    if (usageError) {
      console.error("Error getting search usage:", usageError)
      // Continue with other metrics
    }

    // Get user activity by day of week
    const { data: userActivity, error: activityError } = await supabase.rpc("get_user_activity_by_day", {
      user_id_param: userId,
      start_date_param: startDate.toISOString(),
    })

    if (activityError) {
      console.error("Error getting user activity:", activityError)
      // Continue with other metrics
    }

    // Get system performance metrics
    const { data: performanceData, error: performanceError } = await supabase
      .from("analytics")
      .select("event_data")
      .eq("event_type", "performance")
      .order("created_at", { ascending: false })
      .limit(1)

    if (performanceError) {
      console.error("Error getting performance data:", performanceError)
      // Continue with other metrics
    }

    return NextResponse.json({
      documentCount: documentCount || 0,
      searchCount: searchCount || 0,
      chatCount: chatCount || 0,
      documentTypes: documentTypes || [],
      searchUsage: searchUsage || [],
      userActivity: userActivity || [],
      performance: performanceData?.[0]?.event_data || {
        search_latency: 250,
        indexing_speed: 85,
        chat_response: 320,
        document_processing: 450,
      },
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

    const supabase = getSupabaseServerClient()

    const { data, error } = await supabase
      .from("analytics")
      .insert({
        event_type: eventType,
        event_data: eventData,
        user_id: userId,
      })
      .select()

    if (error) {
      console.error("Error logging analytics event:", error)
      return NextResponse.json({ error: "Failed to log analytics event" }, { status: 500 })
    }

    return NextResponse.json({ success: true, event: data[0] })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
