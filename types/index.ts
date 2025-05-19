export interface CreateMessageOptions {
  conversationId: string
  role: "user" | "assistant" | "system"
  content: string
  sources?: string[]
  turnIndex?: number
}
