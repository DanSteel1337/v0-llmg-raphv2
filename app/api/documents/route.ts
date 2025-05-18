import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-client"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching documents:", error)
      return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
    }

    return NextResponse.json({ documents: data })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId, name, description, fileType, fileSize, filePath } = await request.json()

    if (!userId || !name || !fileType || !fileSize || !filePath) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    const { data, error } = await supabase
      .from("documents")
      .insert({
        user_id: userId,
        name,
        description,
        file_type: fileType,
        file_size: fileSize,
        file_path: filePath,
        status: "processing",
        processing_progress: 0,
      })
      .select()

    if (error) {
      console.error("Error creating document:", error)
      return NextResponse.json({ error: "Failed to create document" }, { status: 500 })
    }

    // In a real implementation, you would trigger a background job to process the document
    // For now, we'll simulate this with a simple response

    return NextResponse.json({ document: data[0] })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
