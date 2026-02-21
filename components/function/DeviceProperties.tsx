"use client";

import { useEffect, useState } from "react";
import { PropertyCard } from "./PropertyCard";
import { fetchThing } from "@/lib/actions/arduino";
import { getAlertStateForProperties } from "@/app/actions/settings";

interface DevicePropertiesProps {
    thingId: string;
    initialProperties: any[];
    initialAlertMap: Record<string, boolean>;
    initialRecordingConfigMap: Record<string, { enabled: boolean; intervalMinutes: number | null; maxRows: number | null }>;
}

export function DeviceProperties({ thingId, initialProperties, initialAlertMap, initialRecordingConfigMap }: DevicePropertiesProps) {
    const [properties, setProperties] = useState(initialProperties);
    const [alertMap, setAlertMap] = useState<Record<string, boolean>>(initialAlertMap);

    const refreshProperties = async () => {
        try {
            const result = await fetchThing(thingId);
            if (result.success && result.data?.properties) {
                const next = result.data.properties as any[];
                setProperties(next);
                const nextAlertMap = await getAlertStateForProperties(
                    thingId,
                    next.map((p: any) => ({ id: p.id, type: p.type, last_value: p.last_value }))
                );
                setAlertMap(nextAlertMap);
            }
        } catch (error) {
            console.error("Failed to fetch device properties:", error);
        }
    };

    useEffect(() => {
        refreshProperties();
        const interval = setInterval(refreshProperties, 5000);
        return () => clearInterval(interval);
    }, [thingId]);

    return (
        <div className="grid gap-6">
            {properties.map((property: any) => (
                <PropertyCard
                    key={property.id}
                    property={property}
                    thingId={thingId}
                    onUpdate={refreshProperties}
                    inAlert={alertMap[property.id] ?? false}
                    recordingConfig={initialRecordingConfigMap[property.id]}
                />
            ))}
        </div>
    );
} 
