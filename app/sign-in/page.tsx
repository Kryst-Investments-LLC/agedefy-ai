import { SignInForm } from "@/components/auth/sign-in-form"

type SignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const callbackParam = resolvedSearchParams?.callbackUrl
  const callbackUrl = Array.isArray(callbackParam) ? callbackParam[0] : callbackParam ?? "/dashboard"

  return (
    <main className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-md">
        <SignInForm callbackUrl={callbackUrl} />
      </div>
    </main>
  )
}