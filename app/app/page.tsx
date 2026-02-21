import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ExternalLink, AlertTriangle, CheckCircle, CircuitBoard, Activity } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getDevices } from "@/lib/arduinoInit"
import { evaluateThingAlerts } from "@/lib/alertEvaluation"
import { FormattedDateTime } from "@/components/FormattedDateTime"
import React from "react"

export default async function Page() {
    const devices = await getDevices();

    const activePlcs = devices.filter((d) => d.device_status === "ONLINE").length;

    const deviceAlertMap: Record<string, number> = {};
    let totalPropertyAlerts = 0;

    for (const device of devices) {
        if (device.device_status !== "ONLINE") continue;
        const thingId = device.thing?.id ?? device.id;
        const { alertCount } = await evaluateThingAlerts(thingId, device.name ?? device.id, {
            sendSmsForNewAlerts: true,
        });
        deviceAlertMap[device.id] = alertCount;
        totalPropertyAlerts += alertCount;
    }

    const offlineDevices = devices.filter((d) => d.device_status !== "ONLINE").length;
    const systemStatus = offlineDevices === 0 ? "Operational" : offlineDevices < devices.length / 2 ? "Degraded" : "Critical";
    const systemStatusColor = systemStatus === "Operational" ? "text-green-500" : systemStatus === "Degraded" ? "text-yellow-500" : "text-red-500";
    const systemStatusMessage = systemStatus === "Operational" ? "All systems normal" : systemStatus === "Degraded" ? `${offlineDevices} device${offlineDevices > 1 ? "s" : ""} offline` : "Multiple systems down";

    return (
        <main className="w-full h-full flex justify-center items-center">
            <div className="container h-full p-10">
                <div className="tracking-tight font-bold">
                    <p className="text-4xl text-tama font-serif">Dashboard</p>
                    <p className="text-sm font-semibold text-muted-foreground">Welcome to the TAMU OSSF Center SCADA System</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-8">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active PLC Devices</CardTitle>
                            <CircuitBoard className="h-4 w-4 text-maroon" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{activePlcs}</div>
                            <p className="text-xs text-muted-foreground">
                                {devices.length > 0 ? `${activePlcs} of ${devices.length} online` : "No devices found"}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">System Status</CardTitle>
                            <Activity className={`h-4 w-4 ${systemStatusColor}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{systemStatus}</div>
                            <p className="text-xs text-muted-foreground">{systemStatusMessage}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
                            {totalPropertyAlerts > 0 ? (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                            ) : (
                                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalPropertyAlerts}</div>
                            <p className="text-xs text-muted-foreground">
                                {totalPropertyAlerts === 0 ? "No property alerts" : totalPropertyAlerts === 1 ? "1 property out of range" : `${totalPropertyAlerts} properties out of range`}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <PLCTable devices={devices} deviceAlertMap={deviceAlertMap} />
            </div>
        </main>
    )
}

async function PLCTable({
    devices,
    deviceAlertMap,
}: {
    devices: Awaited<ReturnType<typeof getDevices>>;
    deviceAlertMap: Record<string, number>;
}) {
    return (
        <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 mt-10">
                <h2 className="text-2xl font-bold text-tama font-serif mb-4 sm:mb-0">Active Systems</h2>
            </div>

            <div className="rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>PLC ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Active</TableHead>
                            <TableHead className="text-right">Details</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {devices.map((device) => {
                            const hasAlert = (deviceAlertMap[device.id] ?? 0) > 0;
                            return (
                                <TableRow key={device.id}>
                                    <TableCell className="font-medium">
                                        <span className="inline-flex items-center gap-1">
                                            {device.id}
                                            {hasAlert && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" aria-label="Property alert" />}
                                        </span>
                                    </TableCell>
                                    <TableCell>{device.name}</TableCell>
                                    <TableCell>
                                        {device.device_status === "ONLINE" ? (
                                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                                Online
                                            </Badge>
                                        ) : !device.ota_available ? (
                                            <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                                                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                                                Warning
                                            </Badge>
                                        ) : null}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">{device.last_activity_at ? <FormattedDateTime iso={device.last_activity_at} format="time" /> : "—"}</TableCell>
                                    <TableCell className="text-right">
                                        <Link href={`/app/device/${device.id}`}>
                                            <Button variant="outline" size="sm">
                                                Details
                                                <ExternalLink className="ml-1 h-3.5 w-3.5" />
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                    <TableCaption>Showing {devices.length} PLCs</TableCaption>
                </Table>
            </div>
        </>
    );
}
