export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-900">
      <div className="h-16 border-b border-gray-800 bg-gray-900" />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-800" />
          <div className="h-10 w-48 animate-pulse rounded bg-gray-800" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-800 bg-gray-950 p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-20 animate-pulse rounded bg-gray-800" />
                  <div className="h-5 w-48 animate-pulse rounded bg-gray-800" />
                  <div className="h-3 w-full animate-pulse rounded bg-gray-800" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-gray-800" />
                </div>
                <div className="h-6 w-16 animate-pulse rounded bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
