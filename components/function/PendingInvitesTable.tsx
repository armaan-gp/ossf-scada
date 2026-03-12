"use client"

import { Fragment, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { regenerateInvite, revokeInvite, type PendingInviteItem } from "@/app/actions/admin"
import { useToast } from "@/hooks/use-toast"

interface PendingInvitesTableProps {
  invites: PendingInviteItem[]
}

type ClipboardResult = {
  success: boolean
  method: "clipboard" | "execCommand" | "none"
  error?: string
}

export function PendingInvitesTable({ invites }: PendingInvitesTableProps) {
  const { toast } = useToast()
  const [inviteRows, setInviteRows] = useState<PendingInviteItem[]>(invites)
  const [manualCopyByInviteId, setManualCopyByInviteId] = useState<Record<number, string>>({})

  async function copyToClipboardWithFallback(text: string): Promise<ClipboardResult> {
    let firstError: unknown

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return { success: true, method: "clipboard" }
      }
    } catch (error) {
      firstError = error
    }

    try {
      if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea")
        textarea.value = text
        textarea.setAttribute("readonly", "")
        textarea.style.position = "fixed"
        textarea.style.left = "-9999px"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        textarea.setSelectionRange(0, textarea.value.length)
        const copied = document.execCommand("copy")
        document.body.removeChild(textarea)
        if (copied) {
          return { success: true, method: "execCommand" }
        }
      }
    } catch (error) {
      if (!firstError) firstError = error
    }

    return {
      success: false,
      method: "none",
      error: firstError instanceof Error ? firstError.message : "Clipboard access was blocked by your browser.",
    }
  }

  async function handleRevoke(id: number) {
    if (!window.confirm("Revoke this invite? The link will stop working immediately.")) {
      return
    }
    const result = await revokeInvite(id)
    if (!result.ok) {
      toast({ title: "Error", description: result.message, variant: "destructive" })
      return
    }
    setInviteRows((prev) => prev.filter((invite) => invite.id !== id))
    setManualCopyByInviteId((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    toast({ title: "Invite revoked", description: result.message })
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

    const regeneratedCreatedAt = new Date()
    setInviteRows((prev) =>
      prev.map((invite) =>
        invite.id === id
          ? {
              ...invite,
              id: result.data.inviteId,
              createdAt: regeneratedCreatedAt,
              expiresAt: new Date(result.data.expiresAt),
            }
          : invite
      )
    )

    setManualCopyByInviteId((prev) => {
      const next = { ...prev, [result.data.inviteId]: result.data.inviteLink }
      delete next[id]
      return next
    })
    toast({
      title: "Invite regenerated",
      description: "Invite regenerated. Use Copy Link below.",
    })
  }

  async function handleManualCopy(id: number) {
    const link = manualCopyByInviteId[id]
    if (!link) return

    const copyResult = await copyToClipboardWithFallback(link)
    if (!copyResult.success) {
      toast({
        title: "Copy failed",
        description: copyResult.error ?? "Clipboard access is still blocked by your browser.",
        variant: "destructive",
      })
      return
    }

    setManualCopyByInviteId((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    toast({ title: "Copied", description: "Invite link copied to clipboard." })
  }

  if (inviteRows.length === 0) {
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
          {inviteRows.map((invite) => (
            <Fragment key={invite.id}>
              <tr className="border-b hover:bg-gray-50">
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
                    Regenerate + Copy
                  </Button>
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
              {manualCopyByInviteId[invite.id] && (
                <tr className="border-b bg-amber-50/40">
                  <td colSpan={6} className="py-3 px-2">
                    <p className="text-xs text-gray-700 mb-2">
                      Link regenerated successfully. Use this button to copy the new link.
                    </p>
                    <p className="text-xs text-gray-600 break-all mb-2">{manualCopyByInviteId[invite.id]}</p>
                    <Button variant="outline" size="sm" onClick={() => handleManualCopy(invite.id)}>
                      Copy Link
                    </Button>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
