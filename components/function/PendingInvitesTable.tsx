"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { regenerateInvite, revokeInvite, type PendingInviteItem } from "@/app/actions/admin"
import { useToast } from "@/hooks/use-toast"

interface PendingInvitesTableProps {
  invites: PendingInviteItem[]
}

export function PendingInvitesTable({ invites }: PendingInvitesTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [generatedLinks, setGeneratedLinks] = useState<Record<number, string>>({})

  async function handleRevoke(id: number) {
    if (!window.confirm("Revoke this invite? The link will stop working immediately.")) {
      return
    }
    const result = await revokeInvite(id)
    if (!result.ok) {
      toast({ title: "Error", description: result.message, variant: "destructive" })
      return
    }
    toast({ title: "Invite revoked", description: result.message })
    router.refresh()
  }

  async function handleRegenerate(id: number) {
    if (!window.confirm("Regenerate this invite? The previous link will be revoked.")) {
      return
    }
    const result = await regenerateInvite(id)
    if (!result.ok) {
      toast({ title: "Error", description: result.message, variant: "destructive" })
      return
    }

    setGeneratedLinks((prev) => ({ ...prev, [id]: result.data.inviteLink }))
    toast({ title: "Invite regenerated", description: "New invite link generated." })
  }

  async function copyLink(id: number) {
    const link = generatedLinks[id]
    if (!link) return
    await navigator.clipboard.writeText(link)
    toast({ title: "Copied", description: "Invite link copied to clipboard." })
  }

  if (invites.length === 0) {
    return <p className="text-sm text-gray-500">No pending invites.</p>
  }

  const roleLabel = (role: "admin" | "user") => (role === "admin" ? "Admin" : "User")

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-2 font-medium text-gray-500">Name</th>
            <th className="text-left py-3 px-2 font-medium text-gray-500">Email</th>
            <th className="text-left py-3 px-2 font-medium text-gray-500">Role</th>
            <th className="text-left py-3 px-2 font-medium text-gray-500">Created</th>
            <th className="text-left py-3 px-2 font-medium text-gray-500">Expires</th>
            <th className="text-right py-3 px-2 font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invites.map((invite) => (
            <tr key={invite.id} className="border-b hover:bg-gray-50">
              <td className="py-3 px-2">{invite.name}</td>
              <td className="py-3 px-2">{invite.email}</td>
              <td className="py-3 px-2">
                <Badge variant="secondary" className={invite.role === "admin" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}>
                  {roleLabel(invite.role)}
                </Badge>
              </td>
              <td className="py-3 px-2">{new Date(invite.createdAt).toLocaleString()}</td>
              <td className="py-3 px-2">{new Date(invite.expiresAt).toLocaleString()}</td>
              <td className="py-3 px-2 text-right whitespace-nowrap">
                <Button variant="outline" size="sm" className="mr-2" onClick={() => handleRegenerate(invite.id)}>
                  Regenerate Link
                </Button>
                {generatedLinks[invite.id] && (
                  <Button variant="outline" size="sm" className="mr-2" onClick={() => copyLink(invite.id)}>
                    Copy Link
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => handleRevoke(invite.id)}
                >
                  Revoke
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
