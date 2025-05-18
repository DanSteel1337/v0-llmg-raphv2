import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-client"

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseServerClient()

    const { data, error } = await supabase.from("system_settings").select("*")

    if (error) {
      console.error("Error fetching settings:", error)
      return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
    }

    // Convert array to object with key as the key
    const settings = data.reduce(
      (acc, setting) => {
        acc[setting.key] = setting.value
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

    const supabase = getSupabaseServerClient()

    // Check if setting exists
    const { data: existingData, error: existingError } = await supabase
      .from("system_settings")
      .select("*")
      .eq("key", key)
      .maybeSingle()

    if (existingError) {
      console.error("Error checking existing setting:", existingError)
      return NextResponse.json({ error: "Failed to check existing setting" }, { status: 500 })
    }

    let result

    if (existingData) {
      // Update existing setting
      const { data, error } = await supabase
        .from("system_settings")
        .update({
          value,
          description: description || existingData.description,
        })
        .eq("key", key)
        .select()

      if (error) {
        console.error("Error updating setting:", error)
        return NextResponse.json({ error: "Failed to update setting" }, { status: 500 })
      }

      result = data[0]
    } else {
      // Create new setting
      const { data, error } = await supabase
        .from("system_settings")
        .insert({
          key,
          value,
          description,
        })
        .select()

      if (error) {
        console.error("Error creating setting:", error)
        return NextResponse.json({ error: "Failed to create setting" }, { status: 500 })
      }

      result = data[0]
    }

    return NextResponse.json({ setting: result })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
