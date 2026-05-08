export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-900">
      <div className="h-16 border-b border-gray-800 bg-gray-900" />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-800" />
          <div className="h-10 w-48 animate-pulse rounded bg-gray-800" />
          <div className="h-4 w-96 animate-pulse rounded bg-gray-800" />
        </div>
        <div className="mb-6 flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded-lg bg-gray-800" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-800 bg-gray-950 p-5">
              <div className="flex justify-between">
                <div className="h-5 w-16 animate-pulse rounded bg-gray-800" />
                <div className="h-5 w-24 animate-pulse rounded bg-gray-800" />
              </div>
              <div className="mt-3 h-5 w-40 animate-pulse rounded bg-gray-800" />
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-gray-800" />
              <div className="mt-4 flex items-center justify-between">
                <div className="h-7 w-16 animate-pulse rounded bg-gray-800" />
                <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
