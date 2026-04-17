"use client";

import { clearAlertHistory } from "@/app/actions/alerts";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useState } from "react";

const CLEAR_WARNING =
  "This will permanently delete all alert history rows. This action cannot be undone. Continue?";

export function AlertHistoryMaintenanceForm({ canClear }: { canClear: boolean }) {
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function handleClear() {
    if (!canClear) return;
    if (!window.confirm(CLEAR_WARNING)) return;

    setPending(true);
    const result = await clearAlertHistory();
    setPending(false);

    if (!result.ok) {
      toast({
        title: "Error",
        description: result.error ?? "Failed to clear alert history.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Cleared",
      description: "Alert history has been cleared.",
    });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="destructive"
        disabled={!canClear || pending}
        onClick={handleClear}
      >
        {pending ? "Clearing..." : "Clear alert history"}
      </Button>
      {canClear ? (
        <p className="text-xs text-muted-foreground">
          Deletes all rows from alert history records only. Active alert/cooldown state is kept.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Admins only. You can view history, but only admins can clear it.
        </p>
      )}
    </div>
  );
}
