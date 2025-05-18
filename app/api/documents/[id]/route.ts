import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-client"

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    if (!id) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Delete the document
    const { error } = await supabase.from("documents").delete().eq("id", id)

    if (error) {
      console.error("Error deleting document:", error)
      return NextResponse.json({ error: "Failed to delete document" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const { status, processing_progress, error_message } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Update the document status
    const { data, error } = await supabase
      .from("documents")
      .update({
        status,
        processing_progress,
        error_message,
      })
      .eq("id", id)
      .select()

    if (error) {
      console.error("Error updating document:", error)
      return NextResponse.json({ error: "Failed to update document" }, { status: 500 })
    }

    return NextResponse.json({ document: data[0] })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
