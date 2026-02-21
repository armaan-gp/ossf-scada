import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings } from "lucide-react"
import { GmailAccountForm, SmsRecipientsForm } from "@/components/function/SmsConfigForm"
import { AlertThresholdsEditor } from "@/components/function/AlertThresholdsEditor"
import { getSmsConfig, getThresholdsMap } from "@/app/actions/settings"
import { getCsvRecordingConfigMap } from "@/app/actions/csv"
import { getPlcsWithProperties } from "@/lib/plcsWithProperties"
import { CsvRecordingEditor } from "@/components/function/CsvRecordingEditor"

export default async function SettingsPage() {
  const [smsConfig, plcs, thresholdsMap, csvConfigMap] = await Promise.all([
    getSmsConfig(),
    getPlcsWithProperties().catch(() => []),
    getThresholdsMap(),
    getCsvRecordingConfigMap(),
  ])

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center mb-6">
        <span className="text-sm font-medium flex items-center">
          <Settings className="h-4 w-4 mr-1" />
          Settings
        </span>
      </div>

      <h1 className="text-3xl font-bold text-[#500000] mb-1">Settings</h1>
      <p className="text-gray-500 mb-6">Configure SMS alerts and system options</p>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Gmail account</CardTitle>
          <CardDescription>
            Sender email and App Password used to send SMS alerts. Update these separately from recipients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GmailAccountForm initialConfig={smsConfig} />
        </CardContent>
      </Card>

      <Card className="max-w-2xl mt-6">
        <CardHeader>
          <CardTitle>SMS recipients</CardTitle>
          <CardDescription>
            Phone numbers and carriers that will receive alert SMS messages. Add multiple recipients if needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SmsRecipientsForm initialRecipients={smsConfig?.recipients ?? []} />
        </CardContent>
      </Card>

      <Card className="max-w-2xl mt-6">
        <CardHeader>
          <CardTitle>Alert thresholds</CardTitle>
          <CardDescription>
            Optional min/max for INT and FLOAT properties. Leave blank to disable alerts for that threshold.
            If only min is set, alerts trigger when value falls below min. If only max is set, alerts trigger when value exceeds max.
            Values outside range trigger alerts and SMS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertThresholdsEditor plcs={plcs} initialThresholds={thresholdsMap} />
        </CardContent>
      </Card>

      <Card className="max-w-2xl mt-6">
        <CardHeader>
          <CardTitle>CSV data recording</CardTitle>
          <CardDescription>
            Choose which PLC properties to log to CSV. Set recording interval (minutes) and max rows per property.
            When the max is reached, the oldest row is removed as new data is added. Changing settings or turning off
            recording will delete existing CSV data for that property—download the file from the device page first if needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CsvRecordingEditor plcs={plcs} initialConfig={csvConfigMap} />
        </CardContent>
      </Card>
    </div>
  )
}
