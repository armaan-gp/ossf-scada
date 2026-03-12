"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createInviteFormSchema, type CreateInviteFormSchemaType } from "@/forms/userManagement"
import { createInvite } from "@/app/actions/admin"
import { useToast } from "@/hooks/use-toast"

export function AddUserForm() {
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null)
  const [lastInviteExpiry, setLastInviteExpiry] = useState<string | null>(null)

  const form = useForm<CreateInviteFormSchemaType>({
    resolver: zodResolver(createInviteFormSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "user",
    },
  })

  function onSubmit(values: CreateInviteFormSchemaType) {
    startTransition(async () => {
      const result = await createInvite(values)
      if (!result.ok) {
        toast({ title: "Error", description: result.message, variant: "destructive" })
        return
      }

      setLastInviteLink(result.data.inviteLink)
      setLastInviteExpiry(result.data.expiresAt)
      window.dispatchEvent(
        new CustomEvent("invite-created", {
          detail: {
            id: result.data.inviteId,
            name: values.name.trim(),
            email: values.email.trim().toLowerCase(),
            role: values.role,
            expiresAt: result.data.expiresAt,
          },
        })
      )
      form.reset({ name: "", email: "", role: "user" })
      toast({ title: "Invite created", description: "Copy and share the one-time invite link." })
    })
  }

  async function copyLink() {
    if (!lastInviteLink) return
    await navigator.clipboard.writeText(lastInviteLink)
    toast({ title: "Copied", description: "Invite link copied to clipboard." })
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter full name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <Input placeholder="user@tamu.org" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full bg-tama text-white hover:bg-[#5A1818] transition-colors duration-200"
            disabled={pending}
          >
            {pending ? "Creating Invite..." : "Create Invite"}
          </Button>
        </form>
      </Form>

      {lastInviteLink && (
        <div className="rounded-md border p-3 bg-gray-50">
          <p className="text-sm font-medium text-gray-700">Latest Invite Link</p>
          <p className="text-xs text-gray-600 break-all mt-1">{lastInviteLink}</p>
          {lastInviteExpiry && <p className="text-xs text-gray-500 mt-1">Expires: {new Date(lastInviteExpiry).toLocaleString()}</p>}
          <Button type="button" variant="outline" className="mt-3" onClick={copyLink}>
            Copy Invite Link
          </Button>
        </div>
      )}
    </div>
  )
}
