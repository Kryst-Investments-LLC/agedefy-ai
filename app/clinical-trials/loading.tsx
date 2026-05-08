export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-900">
      <div className="h-16 border-b border-gray-800 bg-gray-900" />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-800" />
          <div className="h-10 w-48 animate-pulse rounded bg-gray-800" />
          <div className="h-4 w-80 animate-pulse rounded bg-gray-800" />
        </div>
        <div className="h-10 w-full animate-pulse rounded-lg bg-gray-800 mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-800 bg-gray-950 p-5">
              <div className="h-5 w-64 animate-pulse rounded bg-gray-800" />
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-gray-800" />
              <div className="mt-2 flex gap-2">
                <div className="h-5 w-16 animate-pulse rounded bg-gray-800" />
                <div className="h-5 w-20 animate-pulse rounded bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
