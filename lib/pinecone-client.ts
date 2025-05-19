import { PineconeClient } from "@pinecone-database/pinecone"

const client = new PineconeClient()

export async function getPineconeClient() {
  if (!client.apiKey) {
    await client.init({
      apiKey: process.env.PINECONE_API_KEY!,
      environment: process.env.PINECONE_ENVIRONMENT!,
    })
  }
  return client
}

export async function getPineconeIndex() {
  const client = await getPineconeClient()
  return client.Index(process.env.PINECONE_INDEX_NAME!)
}
