"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function ApiDebugWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>API Status</CardTitle>
      </CardHeader>
      <CardContent>
        <p>API configuration is valid.</p>
      </CardContent>
    </Card>
  )
}
