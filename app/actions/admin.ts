"use server"

import { randomBytes, createHash } from "crypto"
import { db } from "@/db"
import {
  userAuditActionEnum,
  userAuditEventsTable,
  userAuditSourceEnum,
  userInvitesTable,
  usersTable,
  type InviteRole,
  type UserAuditAction,
} from "@/db/schema"
import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { hashPassword } from "@/lib/password"
import { getUser } from "@/lib/actions/auth"
import { acceptInviteFormSchema, createInviteFormSchema } from "@/forms/userManagement"

export type AdminErrorCode =
  | "not_authorized"
  | "validation_error"
  | "already_exists"
  | "not_found"
  | "self_delete_forbidden"
  | "self_disable_forbidden"
  | "last_admin_constraint"
  | "invite_expired"
  | "invite_revoked"
  | "invite_used"
  | "invite_invalid"
  | "internal_error"

export type ActionResult<T = undefined> =
  | { ok: true; message: string; data: T }
  | { ok: false; errorCode: AdminErrorCode; message: string }

export type UserListItem = {
  id: number
  name: string
  email: string
  isAdmin: boolean
  origin: "invite" | "seed" | "manual_script" | "migration"
  status: "invited" | "active" | "disabled"
  createdAt: Date
  updatedAt: Date
  inviteAcceptedAt: Date | null
  lastLoginAt: Date | null
}

export type UserListResult = {
  users: UserListItem[]
  total: number
  page: number
  pageSize: number
  query: string
}

export type PendingInviteItem = {
  id: number
  name: string
  email: string
  role: InviteRole
  createdAt: Date
  expiresAt: Date
  createdByUserId: number | null
}

export type PendingInviteListResult = {
  invites: PendingInviteItem[]
  total: number
  page: number
  pageSize: number
  query: string
}

export type UserAuditListItem = {
  id: number
  actorUserId: number | null
  targetUserId: number | null
  action: (typeof userAuditActionEnum.enumValues)[number]
  source: (typeof userAuditSourceEnum.enumValues)[number]
  metadataJson: string
  createdAt: Date
}

export type UpdateUserInput = {
  id: number
  name: string
  email: string
  role: "admin" | "user"
  status: "active" | "disabled"
}

export type DeleteUserInput = {
  id: number
}

export type CreateInviteInput = {
  name: string
  email: string
  role: "admin" | "user"
}

export type CreateInviteResult = {
  inviteId: number
  inviteLink: string
  expiresAt: string
}

export type RegenerateInviteResult = {
  inviteId: number
  inviteLink: string
  expiresAt: string
}

export type InvitePreview = {
  valid: boolean
  name?: string
  email?: string
  role?: "admin" | "user"
  errorCode?: "invite_invalid" | "invite_used" | "invite_revoked" | "invite_expired"
  message?: string
}

type AcceptInviteResult = {
  activated: boolean
}

const DEFAULT_PAGE_SIZE = 20
const INVITE_TTL_HOURS = 72

function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000"
}

async function getAdminActor() {
  const actor = await getUser()
  if (!actor?.isAdmin || actor.status !== "active") {
    return null
  }
  return actor
}

async function countActiveAdmins(): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(and(eq(usersTable.isAdmin, true), eq(usersTable.status, "active")))
  return Number(result?.total ?? 0)
}

async function createAuditEvent(input: {
  actorUserId: number | null
  targetUserId: number | null
  action: UserAuditAction
  source?: "ui_admin" | "script_seed" | "migration" | "system"
  metadata?: Record<string, unknown>
}) {
  await db.insert(userAuditEventsTable).values({
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    action: input.action,
    source: input.source ?? "ui_admin",
    metadataJson: JSON.stringify(input.metadata ?? {}),
  })
}

export async function getUsers(input?: {
  page?: number
  pageSize?: number
  query?: string
}): Promise<ActionResult<UserListResult>> {
  const actor = await getAdminActor()
  if (!actor) {
    return { ok: false, errorCode: "not_authorized", message: "Not authorized to view users" }
  }

  const page = Math.max(1, input?.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, input?.pageSize ?? DEFAULT_PAGE_SIZE))
  const query = (input?.query ?? "").trim()
  const whereClause = query
    ? or(ilike(usersTable.name, `%${query}%`), ilike(usersTable.email, `%${query}%`))
    : undefined

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        isAdmin: usersTable.isAdmin,
        origin: usersTable.origin,
        status: usersTable.status,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
        inviteAcceptedAt: usersTable.inviteAcceptedAt,
        lastLoginAt: usersTable.lastLoginAt,
      })
      .from(usersTable)
      .where(whereClause)
      .orderBy(desc(usersTable.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(usersTable)
      .where(whereClause),
  ])

  return {
    ok: true,
    message: "Users loaded",
    data: {
      users: rows,
      total: Number(totalRows[0]?.total ?? 0),
      page,
      pageSize,
      query,
    },
  }
}

export async function getPendingInvites(input?: {
  page?: number
  pageSize?: number
  query?: string
}): Promise<ActionResult<PendingInviteListResult>> {
  const actor = await getAdminActor()
  if (!actor) {
    return { ok: false, errorCode: "not_authorized", message: "Not authorized to view invites" }
  }

  const page = Math.max(1, input?.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, input?.pageSize ?? DEFAULT_PAGE_SIZE))
  const query = (input?.query ?? "").trim()
  const searchClause = query ? or(ilike(userInvitesTable.name, `%${query}%`), ilike(userInvitesTable.email, `%${query}%`)) : undefined
  const whereClause = searchClause
    ? and(isNull(userInvitesTable.usedAt), isNull(userInvitesTable.revokedAt), searchClause)
    : and(isNull(userInvitesTable.usedAt), isNull(userInvitesTable.revokedAt))

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: userInvitesTable.id,
        name: userInvitesTable.name,
        email: userInvitesTable.email,
        role: userInvitesTable.role,
        createdAt: userInvitesTable.createdAt,
        expiresAt: userInvitesTable.expiresAt,
        createdByUserId: userInvitesTable.createdByUserId,
      })
      .from(userInvitesTable)
      .where(whereClause)
      .orderBy(desc(userInvitesTable.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(userInvitesTable)
      .where(whereClause),
  ])

  return {
    ok: true,
    message: "Invites loaded",
    data: {
      invites: rows,
      total: Number(totalRows[0]?.total ?? 0),
      page,
      pageSize,
      query,
    },
  }
}

export async function getRecentUserActivity(limit = 20): Promise<ActionResult<UserAuditListItem[]>> {
  const actor = await getAdminActor()
  if (!actor) {
    return { ok: false, errorCode: "not_authorized", message: "Not authorized to view audit events" }
  }

  const rows = await db
    .select({
      id: userAuditEventsTable.id,
      actorUserId: userAuditEventsTable.actorUserId,
      targetUserId: userAuditEventsTable.targetUserId,
      action: userAuditEventsTable.action,
      source: userAuditEventsTable.source,
      metadataJson: userAuditEventsTable.metadataJson,
      createdAt: userAuditEventsTable.createdAt,
    })
    .from(userAuditEventsTable)
    .orderBy(desc(userAuditEventsTable.createdAt))
    .limit(Math.max(1, Math.min(100, limit)))

  return { ok: true, message: "Audit events loaded", data: rows }
}

export async function createInvite(input: CreateInviteInput): Promise<ActionResult<CreateInviteResult>> {
  const actor = await getAdminActor()
  if (!actor) {
    return { ok: false, errorCode: "not_authorized", message: "Not authorized to create invite" }
  }

  const parsed = createInviteFormSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.flatten().formErrors[0] ?? "Invalid invite input"
    return { ok: false, errorCode: "validation_error", message }
  }

  const { name, email, role } = parsed.data
  const normalizedEmail = email.toLowerCase()

  const existingUser = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, normalizedEmail),
  })
  if (existingUser) {
    return { ok: false, errorCode: "already_exists", message: "A user with this email already exists" }
  }

  const token = randomBytes(32).toString("hex")
  const tokenHash = hashInviteToken(token)
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000)

  await db
    .update(userInvitesTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(userInvitesTable.email, normalizedEmail), isNull(userInvitesTable.usedAt), isNull(userInvitesTable.revokedAt)))

  const [inserted] = await db
    .insert(userInvitesTable)
    .values({
      name,
      email: normalizedEmail,
      role,
      tokenHash,
      expiresAt,
      createdByUserId: actor.id,
    })
    .returning({ id: userInvitesTable.id, expiresAt: userInvitesTable.expiresAt })

  const inviteLink = `${getBaseUrl()}/accept-invite?token=${encodeURIComponent(token)}`

  await createAuditEvent({
    actorUserId: actor.id,
    targetUserId: null,
    action: "invite_created",
    source: "ui_admin",
    metadata: { inviteId: inserted.id, email: normalizedEmail, role },
  })

  revalidatePath("/app/user_management")

  return {
    ok: true,
    message: "Invite created",
    data: {
      inviteId: inserted.id,
      inviteLink,
      expiresAt: inserted.expiresAt.toISOString(),
    },
  }
}

export async function revokeInvite(inviteId: number): Promise<ActionResult<{ inviteId: number }>> {
  const actor = await getAdminActor()
  if (!actor) {
    return { ok: false, errorCode: "not_authorized", message: "Not authorized to revoke invite" }
  }

  if (!Number.isInteger(inviteId) || inviteId <= 0) {
    return { ok: false, errorCode: "validation_error", message: "Invalid invite ID" }
  }

  const [invite] = await db
    .update(userInvitesTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(userInvitesTable.id, inviteId), isNull(userInvitesTable.usedAt), isNull(userInvitesTable.revokedAt)))
    .returning({ id: userInvitesTable.id, email: userInvitesTable.email })

  if (!invite) {
    return { ok: false, errorCode: "not_found", message: "Invite not found or already closed" }
  }

  await createAuditEvent({
    actorUserId: actor.id,
    targetUserId: null,
    action: "invite_revoked",
    source: "ui_admin",
    metadata: { inviteId: invite.id, email: invite.email },
  })

  revalidatePath("/app/user_management")
  return { ok: true, message: "Invite revoked", data: { inviteId } }
}

export async function regenerateInvite(inviteId: number): Promise<ActionResult<RegenerateInviteResult>> {
  const actor = await getAdminActor()
  if (!actor) {
    return { ok: false, errorCode: "not_authorized", message: "Not authorized to regenerate invite" }
  }

  if (!Number.isInteger(inviteId) || inviteId <= 0) {
    return { ok: false, errorCode: "validation_error", message: "Invalid invite ID" }
  }

  const current = await db.query.userInvitesTable.findFirst({
    where: eq(userInvitesTable.id, inviteId),
  })

  if (!current || current.usedAt || current.revokedAt) {
    return { ok: false, errorCode: "not_found", message: "Invite not found or already closed" }
  }

  await db
    .update(userInvitesTable)
    .set({ revokedAt: new Date() })
    .where(eq(userInvitesTable.id, inviteId))

  const token = randomBytes(32).toString("hex")
  const tokenHash = hashInviteToken(token)
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000)

  const [replacement] = await db
    .insert(userInvitesTable)
    .values({
      name: current.name,
      email: current.email,
      role: current.role,
      tokenHash,
      expiresAt,
      createdByUserId: actor.id,
    })
    .returning({ id: userInvitesTable.id, expiresAt: userInvitesTable.expiresAt })

  const inviteLink = `${getBaseUrl()}/accept-invite?token=${encodeURIComponent(token)}`

  await createAuditEvent({
    actorUserId: actor.id,
    targetUserId: null,
    action: "invite_created",
    source: "ui_admin",
    metadata: { inviteId: replacement.id, regeneratedFrom: inviteId, email: current.email, role: current.role },
  })

  revalidatePath("/app/user_management")

  return {
    ok: true,
    message: "Invite regenerated",
    data: {
      inviteId: replacement.id,
      inviteLink,
      expiresAt: replacement.expiresAt.toISOString(),
    },
  }
}

export async function updateUser(input: UpdateUserInput): Promise<ActionResult<{ id: number }>> {
  const actor = await getAdminActor()
  if (!actor) {
    return { ok: false, errorCode: "not_authorized", message: "Not authorized to update users" }
  }

  const id = Number(input.id)
  const name = input.name?.trim()
  const email = input.email?.trim().toLowerCase()
  const isAdmin = input.role === "admin"
  const status = input.status

  if (!id || !name || !email || !["active", "disabled"].includes(status)) {
    return { ok: false, errorCode: "validation_error", message: "Name, email, role, and status are required" }
  }

  const existing = await db.query.usersTable.findFirst({ where: eq(usersTable.id, id) })
  if (!existing) {
    return { ok: false, errorCode: "not_found", message: "User not found" }
  }

  if (existing.id === actor.id && status === "disabled") {
    return { ok: false, errorCode: "self_disable_forbidden", message: "You cannot disable your own account" }
  }

  if (existing.isAdmin && existing.status === "active" && (!isAdmin || status !== "active")) {
    const activeAdmins = await countActiveAdmins()
    if (activeAdmins <= 1) {
      return {
        ok: false,
        errorCode: "last_admin_constraint",
        message: "At least one active admin must remain",
      }
    }
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set({
        name,
        email,
        isAdmin,
        status,
        updatedByUserId: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id })

    if (!updated) {
      return { ok: false, errorCode: "not_found", message: "User not found" }
    }

    await createAuditEvent({
      actorUserId: actor.id,
      targetUserId: id,
      action: existing.isAdmin !== isAdmin ? "role_changed" : status === "disabled" ? "user_disabled" : "user_updated",
      source: "ui_admin",
      metadata: {
        before: {
          name: existing.name,
          email: existing.email,
          isAdmin: existing.isAdmin,
          status: existing.status,
        },
        after: { name, email, isAdmin, status },
      },
    })

    revalidatePath("/app/user_management")
    return { ok: true, message: "User updated", data: { id } }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update user"
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { ok: false, errorCode: "already_exists", message: "Email is already in use" }
    }
    return { ok: false, errorCode: "internal_error", message: msg }
  }
}

export async function deleteUser(input: DeleteUserInput): Promise<ActionResult<{ id: number }>> {
  const actor = await getAdminActor()
  if (!actor) {
    return { ok: false, errorCode: "not_authorized", message: "Not authorized to delete users" }
  }

  const id = Number(input.id)
  if (!id || id <= 0) {
    return { ok: false, errorCode: "validation_error", message: "Missing user ID" }
  }

  if (id === actor.id) {
    return { ok: false, errorCode: "self_delete_forbidden", message: "You cannot delete your own account" }
  }

  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, id) })
  if (!target) {
    return { ok: false, errorCode: "not_found", message: "User not found" }
  }

  if (target.isAdmin && target.status === "active") {
    const activeAdmins = await countActiveAdmins()
    if (activeAdmins <= 1) {
      return {
        ok: false,
        errorCode: "last_admin_constraint",
        message: "At least one active admin must remain",
      }
    }
  }

  await db.delete(usersTable).where(eq(usersTable.id, id))

  await createAuditEvent({
    actorUserId: actor.id,
    targetUserId: id,
    action: "user_deleted",
    source: "ui_admin",
    metadata: { deletedUserEmail: target.email, deletedUserName: target.name },
  })

  revalidatePath("/app/user_management")
  return { ok: true, message: "User deleted", data: { id } }
}

export async function getInvitePreview(token: string): Promise<InvitePreview> {
  const tokenHash = hashInviteToken(token)
  const invite = await db.query.userInvitesTable.findFirst({
    where: eq(userInvitesTable.tokenHash, tokenHash),
  })

  if (!invite) {
    return { valid: false, errorCode: "invite_invalid", message: "Invite is invalid" }
  }
  if (invite.usedAt) {
    return { valid: false, errorCode: "invite_used", message: "Invite was already used" }
  }
  if (invite.revokedAt) {
    return { valid: false, errorCode: "invite_revoked", message: "Invite was revoked" }
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return { valid: false, errorCode: "invite_expired", message: "Invite has expired" }
  }

  return {
    valid: true,
    name: invite.name,
    email: invite.email,
    role: invite.role,
  }
}

export async function acceptInvite(
  _prevState: ActionResult<AcceptInviteResult>,
  formData: FormData,
): Promise<ActionResult<AcceptInviteResult>> {
  const parsed = acceptInviteFormSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  })

  if (!parsed.success) {
    return {
      ok: false,
      errorCode: "validation_error",
      message: parsed.error.flatten().formErrors[0] ?? "Invalid input",
    }
  }

  const { token, password } = parsed.data
  const tokenHash = hashInviteToken(token)
  const invite = await db.query.userInvitesTable.findFirst({
    where: eq(userInvitesTable.tokenHash, tokenHash),
  })

  if (!invite) {
    return { ok: false, errorCode: "invite_invalid", message: "Invite is invalid" }
  }
  if (invite.usedAt) {
    return { ok: false, errorCode: "invite_used", message: "Invite was already used" }
  }
  if (invite.revokedAt) {
    return { ok: false, errorCode: "invite_revoked", message: "Invite was revoked" }
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return { ok: false, errorCode: "invite_expired", message: "Invite has expired" }
  }

  const existing = await db.query.usersTable.findFirst({ where: eq(usersTable.email, invite.email) })
  if (existing) {
    return { ok: false, errorCode: "already_exists", message: "An account already exists for this email" }
  }

  const hashedPassword = await hashPassword(password)
  const now = new Date()

  const inserted = await db.transaction(async (tx) => {
    const [userRow] = await tx
      .insert(usersTable)
      .values({
        name: invite.name,
        email: invite.email,
        hashedPassword,
        isAdmin: invite.role === "admin",
        origin: "invite",
        status: "active",
        inviteAcceptedAt: now,
        createdByUserId: invite.createdByUserId,
        updatedByUserId: invite.createdByUserId,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: usersTable.id })

    await tx
      .update(userInvitesTable)
      .set({ usedAt: now })
      .where(eq(userInvitesTable.id, invite.id))

    await tx.insert(userAuditEventsTable).values({
      actorUserId: invite.createdByUserId,
      targetUserId: userRow.id,
      action: "user_activated",
      source: "system",
      metadataJson: JSON.stringify({ inviteId: invite.id, email: invite.email, role: invite.role }),
    })

    return userRow
  })

  revalidatePath("/app/user_management")

  return {
    ok: true,
    message: "Account activated. You can now sign in.",
    data: { activated: !!inserted.id },
  }
}
