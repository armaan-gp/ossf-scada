import Link from "next/link"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, Users } from "lucide-react"
import { UserTable } from "@/components/function/UserTable"
import { AddUserForm } from "@/components/function/AddUserForm"
import { PendingInvitesTable } from "@/components/function/PendingInvitesTable"
import { RecentUserActivity } from "@/components/function/RecentUserActivity"
import { getPendingInvites, getRecentUserActivity, getUsers } from "@/app/actions/admin"
import { getUser } from "@/lib/actions/auth"

const RECENT_ACTIVITY_LIMIT = 8

export default async function UsersSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; invitePage?: string; q?: string }>
}) {
  const actor = await getUser()
  if (!actor?.isAdmin || actor.status !== "active") {
    redirect("/app")
  }

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? "1") || 1)
  const invitePage = Math.max(1, Number(sp.invitePage ?? "1") || 1)
  const query = (sp.q ?? "").trim()

  const [usersResult, invitesResult, auditResult] = await Promise.all([
    getUsers({ page, pageSize: 20, query }),
    getPendingInvites({ page: invitePage, pageSize: 20, query }),
    getRecentUserActivity(RECENT_ACTIVITY_LIMIT),
  ])

  if (!usersResult.ok || !invitesResult.ok || !auditResult.ok) {
    redirect("/app")
  }

  const usersData = usersResult.data
  const invitesData = invitesResult.data

  const userTotalPages = Math.max(1, Math.ceil(usersData.total / usersData.pageSize))
  const inviteTotalPages = Math.max(1, Math.ceil(invitesData.total / invitesData.pageSize))

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center mb-6">
        <Link href="/app/settings" className="text-sm text-gray-500 flex items-center hover:text-[#500000]">
          <Settings className="h-4 w-4 mr-1" />
          Settings
        </Link>
        <span className="mx-2 text-gray-400">/</span>
        <span className="text-sm font-medium flex items-center">
          <Users className="h-4 w-4 mr-1" />
          User Management
        </span>
      </div>

      <h1 className="text-3xl font-bold text-[#500000] mb-1">User Management</h1>
      <p className="text-gray-500 mb-6">Invite, edit, disable, and audit system access</p>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle>Search</CardTitle>
          <CardDescription>Search users and invites by name or email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex gap-2">
            <input
              name="q"
              defaultValue={query}
              placeholder="Search users/invites"
              className="border rounded px-3 py-2 text-sm w-full max-w-sm"
            />
            <button type="submit" className="px-3 py-2 text-sm border rounded hover:bg-gray-50">
              Apply
            </button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>System Users</CardTitle>
              <CardDescription>Manage users who have access to the TAMU OSSF Center SCADA System</CardDescription>
            </CardHeader>
            <CardContent>
              <UserTable users={usersData.users} currentUserId={actor.id} />
              <div className="flex items-center justify-between text-sm mt-4">
                <span>
                  Page {usersData.page} of {userTotalPages}
                </span>
                <div className="space-x-2">
                  <Link
                    className={`px-2 py-1 border rounded ${usersData.page <= 1 ? "pointer-events-none opacity-50" : ""}`}
                    href={`?q=${encodeURIComponent(query)}&page=${Math.max(1, usersData.page - 1)}&invitePage=${invitePage}`}
                  >
                    Previous
                  </Link>
                  <Link
                    className={`px-2 py-1 border rounded ${usersData.page >= userTotalPages ? "pointer-events-none opacity-50" : ""}`}
                    href={`?q=${encodeURIComponent(query)}&page=${Math.min(userTotalPages, usersData.page + 1)}&invitePage=${invitePage}`}
                  >
                    Next
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Pending Invites</CardTitle>
              <CardDescription>Revoke or regenerate invite links that have not been used.</CardDescription>
            </CardHeader>
            <CardContent>
              <PendingInvitesTable invites={invitesData.invites} />
              <div className="flex items-center justify-between text-sm mt-4">
                <span>
                  Page {invitesData.page} of {inviteTotalPages}
                </span>
                <div className="space-x-2">
                  <Link
                    className={`px-2 py-1 border rounded ${invitesData.page <= 1 ? "pointer-events-none opacity-50" : ""}`}
                    href={`?q=${encodeURIComponent(query)}&page=${page}&invitePage=${Math.max(1, invitesData.page - 1)}`}
                  >
                    Previous
                  </Link>
                  <Link
                    className={`px-2 py-1 border rounded ${invitesData.page >= inviteTotalPages ? "pointer-events-none opacity-50" : ""}`}
                    href={`?q=${encodeURIComponent(query)}&page=${page}&invitePage=${Math.min(inviteTotalPages, invitesData.page + 1)}`}
                  >
                    Next
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Recent User Activity</CardTitle>
              <CardDescription>
                Audit trail for invite and user-management changes (latest {RECENT_ACTIVITY_LIMIT} events).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentUserActivity events={auditResult.data} />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Create Invite</CardTitle>
              <CardDescription>Create a one-time invite link for a new user account.</CardDescription>
            </CardHeader>
            <CardContent>
              <AddUserForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
