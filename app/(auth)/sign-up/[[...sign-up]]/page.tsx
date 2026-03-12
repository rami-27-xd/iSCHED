import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary via-primary to-primary/90">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <svg
              className="h-8 w-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">iSched</h1>
          <p className="mt-1 text-sm text-white/70">
            Create your account
          </p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: "mx-auto w-full",
              card: "rounded-2xl shadow-xl border-0",
              formButtonPrimary:
                "bg-primary hover:bg-primary/90 text-primary-foreground",
            },
          }}
        />
      </div>
    </div>
  )
}
