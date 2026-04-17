import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"

export default function NotFound() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-primary">404</p>
        <h1 className="mt-4 text-5xl font-bold">Page not found</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go home
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border px-6 py-3 font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            Open dashboard
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
