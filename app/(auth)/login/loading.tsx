/**
 * Login Loading Component
 *
 * Displays a loading spinner while the login page is loading.
 *
 * @client This component is intended for client-side use only
 */
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div
          className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"
          role="status"
          aria-label="Loading"
        >
          <span className="sr-only">Loading...</span>
        </div>
        <p className="mt-2 text-sm text-gray-500">Loading authentication...</p>
      </div>
    </div>
  )
}
