"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { saveSmsSenderConfig, saveSmsRecipients } from "@/app/actions/settings";
import type { SmsConfigForm as SmsConfigFormType, SmsRecipientEntry } from "@/app/actions/settings";
import { CARRIER_OPTIONS } from "@/lib/smsGateways";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function GmailAccountForm({ initialConfig }: { initialConfig: SmsConfigFormType | null }) {
  const [senderEmail, setSenderEmail] = useState(initialConfig?.senderEmail ?? "");
  const [appPassword, setAppPassword] = useState("");
  const [pending, setPending] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await saveSmsSenderConfig(senderEmail, appPassword);
    setPending(false);
    if (result.ok) {
      toast({ title: "Saved", description: "Gmail account settings saved." });
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
          Create an App Password in Google Account → Security → 2-Step Verification → App passwords.
        </p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save Gmail account"}
      </Button>
    </form>
  );
}

export function SmsRecipientsForm({ initialRecipients }: { initialRecipients: SmsRecipientEntry[] }) {
  const [phoneInput, setPhoneInput] = useState("");
  const [carrierInput, setCarrierInput] = useState("T-Mobile");
  const [pending, setPending] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhoneInput(digits);
    setValidationError(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const digits = phoneInput.replace(/\D/g, "");
    if (digits.length !== 10) {
      setValidationError("Enter a 10-digit phone number.");
      return;
    }
    setPending(true);
    setValidationError(null);
    const newList = [...initialRecipients, { phoneNumber: digits, carrier: carrierInput }];
    const result = await saveSmsRecipients(newList);
    setPending(false);
    if (result.ok) {
      setPhoneInput("");
      setCarrierInput("T-Mobile");
      toast({ title: "Added", description: "Recipient added." });
      router.refresh();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  }

  async function handleDelete(index: number) {
    setPending(true);
    const newList = initialRecipients.filter((_, i) => i !== index);
    const result = await saveSmsRecipients(newList);
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
          <div className="min-w-[140px]">
            <Label className="text-xs">Phone number (10 digits)</Label>
            <Input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              value={phoneInput}
              onChange={handlePhoneChange}
              placeholder="5550000000"
              className="mt-1"
              maxLength={10}
            />
            {validationError && <p className="text-xs text-destructive mt-1">{validationError}</p>}
          </div>
          <div className="w-[180px]">
            <Label className="text-xs">Carrier</Label>
            <Select value={carrierInput} onValueChange={setCarrierInput}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARRIER_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            {initialRecipients.map((r, index) => (
              <div key={`${r.phoneNumber}-${r.carrier}-${index}`} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">{r.phoneNumber} ({r.carrier})</span>
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
