"use client"

import { useActionState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { acceptInvite } from "@/app/actions/admin"

const initialState = {
  ok: false,
  errorCode: "validation_error",
  message: "",
} as const

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState(acceptInvite, initialState)

  useEffect(() => {
    if (state?.ok) {
      router.push("/login")
    }
  }, [state, router])

  return (
    <form ref={formRef} action={action} onSubmit={() => formRef.current?.requestSubmit()} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" minLength={8} required />
      </div>
      <div>
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required />
      </div>
      {!state.ok && state.message && <p className="text-sm text-destructive">{state.message}</p>}
      <Button
        type="submit"
        className="w-full bg-tama text-white hover:bg-[#5A1818] transition-colors duration-200"
        disabled={pending}
      >
        {pending ? "Activating..." : "Activate Account"}
      </Button>
    </form>
  )
}
