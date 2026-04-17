"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { saveAlertCooldownConfig, saveAlertEmailSenderConfig, saveAlertEmailRecipients } from "@/app/actions/settings";
import type { AlertEmailConfigForm as AlertEmailConfigFormType } from "@/app/actions/settings";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const MIN_ALERT_COOLDOWN_MINUTES = 15;

export function GmailAccountForm({ initialConfig }: { initialConfig: AlertEmailConfigFormType | null }) {
  const [senderEmail, setSenderEmail] = useState(initialConfig?.senderEmail ?? "");
  const [appPassword, setAppPassword] = useState("");
  const [pending, setPending] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await saveAlertEmailSenderConfig(senderEmail.trim(), appPassword);
    setPending(false);
    if (result.ok) {
      toast({ title: "Saved", description: "Email sender settings saved." });
      setAppPassword("");
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="senderEmail">Sender email (Gmail)</Label>
        <Input
          id="senderEmail"
          type="email"
          value={senderEmail}
          onChange={(e) => setSenderEmail(e.target.value)}
          placeholder="your@gmail.com"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="appPassword">Gmail App Password</Label>
        <Input
          id="appPassword"
          type="password"
          value={appPassword}
          onChange={(e) => setAppPassword(e.target.value)}
          placeholder={initialConfig ? "Leave blank to keep current" : "16-character app password"}
          className="mt-1"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Create an App Password in Google Account Security under 2-Step Verification, then App passwords.
        </p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save sender settings"}
      </Button>
    </form>
  );
}

function parseWholeNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n)) return null;
  return n;
}

export function AlertCooldownForm({ initialCooldownMinutes }: { initialCooldownMinutes: number }) {
  const initialHours = Math.floor(initialCooldownMinutes / 60);
  const initialMinutes = initialCooldownMinutes % 60;
  const [hours, setHours] = useState(String(initialHours));
  const [minutes, setMinutes] = useState(String(initialMinutes));
  const [pending, setPending] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    const parsedHours = parseWholeNumber(hours);
    const parsedMinutes = parseWholeNumber(minutes);

    if (parsedHours === null || parsedHours < 0) {
      setValidationError("Hours must be a whole number that is 0 or greater.");
      return;
    }
    if (parsedMinutes === null || parsedMinutes < 0 || parsedMinutes > 59) {
      setValidationError("Minutes must be a whole number between 0 and 59.");
      return;
    }

    const totalMinutes = (parsedHours * 60) + parsedMinutes;
    if (totalMinutes < MIN_ALERT_COOLDOWN_MINUTES) {
      setValidationError(`Alert cooldown must be at least ${MIN_ALERT_COOLDOWN_MINUTES} minutes.`);
      return;
    }

    setPending(true);
    const result = await saveAlertCooldownConfig(parsedHours, parsedMinutes);
    setPending(false);

    if (!result.ok) {
      setValidationError(result.error ?? "Failed to save alert cooldown.");
      toast({ title: "Error", description: result.error ?? "Failed to save alert cooldown.", variant: "destructive" });
      return;
    }

    toast({ title: "Saved", description: "Alert cooldown updated." });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="w-24">
          <Label htmlFor="alertCooldownHours">Hours</Label>
          <Input
            id="alertCooldownHours"
            type="number"
            min={0}
            step={1}
            value={hours}
            onChange={(e) => {
              setHours(e.target.value);
              setValidationError(null);
            }}
            className="mt-1"
            disabled={pending}
          />
        </div>
        <div className="w-24">
          <Label htmlFor="alertCooldownMinutes">Minutes</Label>
          <Input
            id="alertCooldownMinutes"
            type="number"
            min={0}
            max={59}
            step={1}
            value={minutes}
            onChange={(e) => {
              setMinutes(e.target.value);
              setValidationError(null);
            }}
            className="mt-1"
            disabled={pending}
          />
        </div>
      </div>
      {validationError ? (
        <p className="text-xs text-destructive">{validationError}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Minimum cooldown is {MIN_ALERT_COOLDOWN_MINUTES} minutes.
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save cooldown"}
      </Button>
    </form>
  );
}

export function EmailRecipientsForm({ initialRecipients }: { initialRecipients: string[] }) {
  const [emailInput, setEmailInput] = useState("");
  const [pending, setPending] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const email = emailInput.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setValidationError("Enter a valid email address.");
      return;
    }
    if (initialRecipients.some((r) => r.toLowerCase() === email)) {
      setValidationError("That recipient already exists.");
      return;
    }

    setPending(true);
    setValidationError(null);
    const newList = [...initialRecipients, email];
    const result = await saveAlertEmailRecipients(newList);
    setPending(false);
    if (result.ok) {
      setEmailInput("");
      toast({ title: "Added", description: "Recipient added." });
      router.refresh();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  }

  async function handleDelete(index: number) {
    setPending(true);
    const newList = initialRecipients.filter((_, i) => i !== index);
    const result = await saveAlertEmailRecipients(newList);
    setPending(false);
    if (result.ok) {
      toast({ title: "Removed", description: "Recipient removed." });
      router.refresh();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="space-y-4">
        <div className="text-sm font-medium">Add recipient</div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[240px]">
            <Label className="text-xs">Recipient email</Label>
            <Input
              type="email"
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value);
                setValidationError(null);
              }}
              placeholder="alerts@example.com"
              className="mt-1"
            />
            {validationError && <p className="text-xs text-destructive mt-1">{validationError}</p>}
          </div>
          <Button type="submit" disabled={pending}>
            Add recipient
          </Button>
        </div>
      </form>

      <div>
        <div className="text-sm font-medium mb-2">Recipients</div>
        {initialRecipients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recipients. Add one above.</p>
        ) : (
          <div className="space-y-2">
            {initialRecipients.map((recipient, index) => (
              <div key={`${recipient}-${index}`} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">{recipient}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground shrink-0"
                  onClick={() => handleDelete(index)}
                  disabled={pending}
                  aria-label="Remove recipient"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
