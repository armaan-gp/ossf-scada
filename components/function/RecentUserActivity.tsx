import type { UserAuditListItem } from "@/app/actions/admin"

interface RecentUserActivityProps {
  events: UserAuditListItem[]
}

export function RecentUserActivity({ events }: RecentUserActivityProps) {
  const visibleEvents = events.slice(0, 8)

  if (events.length === 0) {
    return <p className="text-sm text-gray-500">No user-management events yet.</p>
  }

  return (
    <div className="space-y-3 max-w-2xl">
      {visibleEvents.map((event) => (
        <div key={event.id} className="border rounded-md p-3 w-full max-w-2xl">
          <p className="text-sm font-medium">{event.action}</p>
          <p className="text-xs text-gray-600 mt-1">
            Source: {event.source} | Actor ID: {event.actorUserId ?? "system"} | Target ID: {event.targetUserId ?? "-"}
          </p>
          <p className="text-xs text-gray-500 mt-1">{new Date(event.createdAt).toLocaleString()}</p>
        </div>
      ))}
    </div>
  )
}
