import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings } from "lucide-react"
import { GmailAccountForm, EmailRecipientsForm } from "@/components/function/EmailAlertConfigForm"
import { AlertThresholdsEditor } from "@/components/function/AlertThresholdsEditor"
import { getAlertEmailConfig, getDecimalPlacesMap, getGlobalDecimalPlaces, getThresholdsMap } from "@/app/actions/settings"
import { getAllRecordingConfigsMap } from "@/app/actions/recordings"
import { getPlcsWithProperties } from "@/lib/plcsWithProperties"
import { PropertyRecordingEditor } from "@/components/function/PropertyRecordingEditor"
import { PropertyValueDisplayEditor } from "@/components/function/PropertyValueDisplayEditor"

export default async function SettingsPage() {
  const [alertEmailConfig, plcs, thresholdsMap, recordingConfigsMap, globalDecimalPlaces, propertyDecimalsMap] = await Promise.all([
    getAlertEmailConfig(),
    getPlcsWithProperties().catch(() => []),
    getThresholdsMap(),
    getAllRecordingConfigsMap(),
    getGlobalDecimalPlaces(),
    getDecimalPlacesMap(),
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
      <p className="text-gray-500 mb-6">Configure alert emails and system options</p>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Gmail account</CardTitle>
          <CardDescription>
            Sender email and App Password used to send alert emails.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GmailAccountForm initialConfig={alertEmailConfig} />
        </CardContent>
      </Card>

      <Card className="max-w-2xl mt-6">
        <CardHeader>
          <CardTitle>Email recipients</CardTitle>
          <CardDescription>
            Email addresses that receive alert notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailRecipientsForm initialRecipients={alertEmailConfig?.recipients ?? []} />
        </CardContent>
      </Card>

      <Card className="max-w-2xl mt-6">
        <CardHeader>
          <CardTitle>Alert thresholds</CardTitle>
          <CardDescription>
            Optional min/max for INT and FLOAT properties. Leave blank to disable alerts for that threshold.
            If only min is set, alerts trigger when value falls below min. If only max is set, alerts trigger when value exceeds max.
            Values outside range trigger alerts and email notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertThresholdsEditor plcs={plcs} initialThresholds={thresholdsMap} />
        </CardContent>
      </Card>

      <Card className="max-w-2xl mt-6">
        <CardHeader>
          <CardTitle>Property value display</CardTitle>
          <CardDescription>
            Choose how many decimal places to show for PLC property values across the site. Set a global value or override specific properties.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PropertyValueDisplayEditor
            plcs={plcs}
            initialGlobalDecimalPlaces={globalDecimalPlaces}
            initialPropertyDecimals={propertyDecimalsMap}
          />
        </CardContent>
      </Card>

      <Card className="max-w-2xl mt-6">
        <CardHeader>
          <CardTitle>Property CSV recording</CardTitle>
          <CardDescription>
            Toggle recording per property. Interval must be a multiple of 5 minutes (minimum 5), and max rows must be between 1 and 10000 when enabled.
            Changing interval/max rows or disabling recording clears existing data for that property.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PropertyRecordingEditor plcs={plcs} initialConfigs={recordingConfigsMap} />
        </CardContent>
      </Card>
    </div>
  )
}
