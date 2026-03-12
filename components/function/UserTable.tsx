"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { deleteUser, updateUser, type UserListItem } from "@/app/actions/admin"
import { Edit2, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface UserTableProps {
  users: UserListItem[]
  currentUserId: number
}

function formatDateTime(value: Date | string | null) {
  if (!value) return "-"
  const date = typeof value === "string" ? new Date(value) : value
  return date.toLocaleString()
}

export function UserTable({ users, currentUserId }: UserTableProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [editingUser, setEditingUser] = useState<UserListItem | null>(null)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editRole, setEditRole] = useState<"user" | "admin">("user")
  const [editStatus, setEditStatus] = useState<"active" | "disabled">("active")
  const [pending, setPending] = useState(false)

  function openEdit(user: UserListItem) {
    setEditingUser(user)
    setEditName(user.name)
    setEditEmail(user.email)
    setEditRole(user.isAdmin ? "admin" : "user")
    setEditStatus(user.status === "disabled" ? "disabled" : "active")
  }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingUser) return
    setPending(true)
    const result = await updateUser({
      id: editingUser.id,
      name: editName.trim(),
      email: editEmail.trim(),
      role: editRole,
      status: editStatus,
    })
    setPending(false)

    if (!result.ok) {
      toast({ title: "Error", description: result.message, variant: "destructive" })
      return
    }

    toast({ title: "Updated", description: result.message })
    setEditingUser(null)
    router.refresh()
  }

  async function handleDelete(user: UserListItem) {
    const confirmed = window.confirm(
      `Delete ${user.name} (${user.email})? This action is permanent and removes account access immediately.`
    )
    if (!confirmed) return

    const result = await deleteUser({ id: user.id })
    if (!result.ok) {
      toast({ title: "Error", description: result.message, variant: "destructive" })
      return
    }

    toast({ title: "Deleted", description: result.message })
    router.refresh()
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-2 font-medium text-gray-500">Name</th>
              <th className="text-left py-3 px-2 font-medium text-gray-500">Email</th>
              <th className="text-left py-3 px-2 font-medium text-gray-500">Role</th>
              <th className="text-left py-3 px-2 font-medium text-gray-500">Status</th>
              <th className="text-left py-3 px-2 font-medium text-gray-500">Origin</th>
              <th className="text-left py-3 px-2 font-medium text-gray-500">Created</th>
              <th className="text-left py-3 px-2 font-medium text-gray-500">Last Login</th>
              <th className="text-right py-3 px-2 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-2">{user.name}</td>
                <td className="py-3 px-2">{user.email}</td>
                <td className="py-3 px-2">
                  <Badge variant="secondary" className={user.isAdmin ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}>
                    {user.isAdmin ? "Admin" : "User"}
                  </Badge>
                </td>
                <td className="py-3 px-2">
                  <Badge variant="secondary" className={user.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}>
                    {user.status}
                  </Badge>
                </td>
                <td className="py-3 px-2">{user.origin}</td>
                <td className="py-3 px-2">{formatDateTime(user.createdAt)}</td>
                <td className="py-3 px-2">{formatDateTime(user.lastLoginAt)}</td>
                <td className="py-3 px-2 text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500"
                    onClick={() => openEdit(user)}
                    aria-label="Edit user"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500"
                    onClick={() => handleDelete(user)}
                    aria-label="Delete user"
                    disabled={user.id === currentUserId}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          {editingUser && (
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>Edit user</DialogTitle>
                <DialogDescription>Update identity, role, or access status for this user.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div>
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-role">Role</Label>
                  <Select value={editRole} onValueChange={(v: "user" | "admin") => setEditRole(v)}>
                    <SelectTrigger id="edit-role" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={editStatus} onValueChange={(v: "active" | "disabled") => setEditStatus(v)}>
                    <SelectTrigger id="edit-status" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
