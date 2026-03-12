import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AcceptInviteForm } from "@/components/function/AcceptInviteForm"
import { getInvitePreview } from "@/app/actions/admin"

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="min-h-screen bg-secondary flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-lg space-y-2 bg-white shadow-lg">
          <CardHeader className="text-center">
            <h1 className="text-[#5A1818] text-3xl md:text-4xl font-serif font-semibold tracking-tight">Texas A&M OSSF Center SCADA</h1>
            <CardTitle className="mt-4">Invite link required</CardTitle>
            <CardDescription>Use the invite link you received from an administrator.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/login" className="text-sm text-[#5A1818] underline">
              Back to login
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const preview = await getInvitePreview(token)
  if (!preview.valid) {
    return (
      <div className="min-h-screen bg-secondary flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-lg space-y-2 bg-white shadow-lg">
          <CardHeader className="text-center">
            <h1 className="text-[#5A1818] text-3xl md:text-4xl font-serif font-semibold tracking-tight">Texas A&M OSSF Center SCADA</h1>
            <CardTitle className="mt-4">Invite unavailable</CardTitle>
            <CardDescription>{preview.message ?? "This invite cannot be used."}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/login" className="text-sm text-[#5A1818] underline">
              Back to login
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const roleLabel = preview.role === "admin" ? "Admin" : "User"

  return (
    <div className="min-h-screen bg-secondary flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-lg space-y-2 bg-white shadow-lg">
        <CardHeader className="text-center">
          <h1 className="text-[#5A1818] text-3xl md:text-4xl font-serif font-semibold tracking-tight">Texas A&M OSSF Center SCADA</h1>
          <CardTitle className="mt-4">Activate your account</CardTitle>
          <CardDescription>
            {preview.name} ({preview.email}) invited as {roleLabel}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AcceptInviteForm token={token} />
        </CardContent>
      </Card>
    </div>
  )
}
