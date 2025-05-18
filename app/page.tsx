import Link from "next/link"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm lg:flex">
        <h1 className="text-4xl md:text-5xl font-bold mb-8 text-center lg:text-left text-gray-800">
          Vector RAG Dashboard
        </h1>
      </div>

      <p className="text-lg text-gray-600 max-w-2xl text-center mb-12">
        A powerful dashboard for managing vector-based retrieval augmented generation with Pinecone and OpenAI.
      </p>

      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-3 lg:text-left gap-6">
        <Link
          href="/documents"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-white hover:shadow-md"
        >
          <h2 className="mb-3 text-2xl font-semibold text-gray-800">
            Documents{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm text-gray-600">
            Manage your documents and see their processing status. Upload, delete, and track indexing progress.
          </p>
        </Link>

        <Link
          href="/search"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-white hover:shadow-md"
        >
          <h2 className="mb-3 text-2xl font-semibold text-gray-800">
            Search{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm text-gray-600">
            Search through your documents using semantic or keyword search. Filter by document type and date range.
          </p>
        </Link>

        <Link
          href="/chat"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-white hover:shadow-md"
        >
          <h2 className="mb-3 text-2xl font-semibold text-gray-800">
            Chat{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm text-gray-600">
            Chat with your documents using RAG-powered AI. Get answers with citations from your knowledge base.
          </p>
        </Link>
      </div>

      <div className="mt-16 text-center">
        <Link
          href="/analytics"
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          View Analytics Dashboard
        </Link>
      </div>
    </main>
  )
}
