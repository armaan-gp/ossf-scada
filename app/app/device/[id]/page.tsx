import { ArrowLeft, Activity, Clock, MapPin, Settings } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getDevice, getThing } from "@/lib/arduinoInit"
import { DeviceProperties } from "@/components/function/DeviceProperties"
import { evaluateThingAlerts } from "@/lib/alertEvaluation"
import { FormattedDateTime } from "@/components/FormattedDateTime"

// Device detail page component that displays information about a specific device
export default async function SystemDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params;
    const deviceData = await getDevice(id);

    if (!deviceData) {
        return (
            <div className="container mx-auto p-6">
                <div className="flex items-center mb-6">
                    <Link href="/app/">
                        <Button variant="outline" size="sm" className="mr-4">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Dashboard
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-red-600">Device not found</h1>
                </div>
            </div>
        );
    }

    const device = JSON.parse(JSON.stringify(deviceData));

    if (!device.thing) {
        try {
            const thingData = await getThing(device.id);
            device.thing = JSON.parse(JSON.stringify(thingData));
        } catch (error) {
            console.error("Failed to fetch thing details:", error);
        }
    }

    const thingId = device.thing?.id ?? device.id;
    const { alerts: alertStates } = await evaluateThingAlerts(thingId, device.name ?? device.id, {
        sendSmsForNewAlerts: true,
    });
    const initialAlertMap: Record<string, boolean> = {};
    for (const a of alertStates) {
        initialAlertMap[a.propertyId] = a.inAlert;
    }

    return (
        <div className="container mx-auto p-6">
            {/* Page header with back button and device name */}
            <div className="flex items-center mb-6">
                <Link href="/app/">
                    <Button variant="outline" size="sm" className="mr-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Button>
                </Link>
                <h1 className="text-2xl font-bold text-[#6B1D23]">{device.name}</h1>
            </div>

            {/* Device information cards grid */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* PLC Information card */}
                <Card>
                    <CardHeader>
                        <CardTitle>PLC Information</CardTitle>
                        <CardDescription>Basic information about this PLC device</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">PLC ID</dt>
                                <dd className="text-sm font-semibold">{device.id}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Name</dt>
                                <dd className="text-sm font-semibold flex items-center">{device.name}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Model</dt>
                                <dd className="text-sm font-semibold">{device.type}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Last Active</dt>
                                <dd className="text-sm font-semibold flex items-center">
                                    <Clock className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                                    <FormattedDateTime iso={device.last_activity_at!} />
                                </dd>
                            </div>
                        </dl>
                    </CardContent>
                </Card>

                {/* Maintenance Information card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Maintenance Information</CardTitle>
                        <CardDescription>Maintenance schedule and history</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid grid-cols-1 gap-4">
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                                <dd className="text-sm font-semibold text-green-600 flex items-center">
                                    <Activity className="mr-1 h-3.5 w-3.5" />
                                    {device.device_status == "ONLINE" ? "Online" : "Offline"}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Serial Number</dt>
                                <dd className="text-sm font-semibold flex items-center">
                                    {device.serial}
                                </dd>
                            </div>
                        </dl>
                    </CardContent>
                </Card>
            </div>

            {/* Arduino Properties card */}
            <Card className="mb-8 mt-10">
                <CardHeader>
                    <div className="flex items-center">
                        <Settings className="mr-2 h-5 w-5 text-muted-foreground" />
                        <CardTitle>Arduino Properties</CardTitle>
                    </div>
                    <CardDescription>Connected IoT device properties and their current values</CardDescription>
                </CardHeader>
                <CardContent>
                    <DeviceProperties
                        thingId={thingId}
                        initialProperties={JSON.parse(JSON.stringify(device.thing?.properties || []))}
                        initialAlertMap={initialAlertMap}
                    />
                </CardContent>
            </Card>
        </div>
    )
}

