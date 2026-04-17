"use client";


// Live property grid that polls PLC values and updates alert status in place.
import { useCallback, useEffect, useState } from "react";
import { PropertyCard } from "./PropertyCard";
import { fetchThing } from "@/lib/actions/arduino";
import { getAlertStateForProperties } from "@/app/actions/settings";
import type { ThingProperty } from "@/lib/arduinoInit";

interface DevicePropertiesProps {
    thingId: string;
    initialProperties: ThingProperty[];
    initialAlertMap: Record<string, boolean>;
    initialRecordingConfigMap: Record<string, { enabled: boolean; intervalMinutes: number | null; maxRows: number | null }>;
    globalDecimalPlaces: number | null;
    propertyDecimalPlacesMap: Record<string, number | null>;
}

export function DeviceProperties({
    thingId,
    initialProperties,
    initialAlertMap,
    initialRecordingConfigMap,
    globalDecimalPlaces,
    propertyDecimalPlacesMap,
}: DevicePropertiesProps) {
    const [properties, setProperties] = useState<ThingProperty[]>(initialProperties);
    const [alertMap, setAlertMap] = useState<Record<string, boolean>>(initialAlertMap);

    const refreshProperties = useCallback(async () => {
        try {
            const result = await fetchThing(thingId);
            if (result.success && result.data?.properties) {
                const next = result.data.properties as ThingProperty[];
                setProperties(next);
                const nextAlertMap = await getAlertStateForProperties(
                    thingId,
                    next.map((p) => ({ id: p.id, type: p.type ?? "", last_value: p.last_value }))
                );
                setAlertMap(nextAlertMap);
            }
        } catch (error) {
            console.error("Failed to fetch device properties:", error);
        }
    }, [thingId]);

    useEffect(() => {
        void refreshProperties();
        const interval = setInterval(() => {
            void refreshProperties();
        }, 5000);
        return () => clearInterval(interval);
    }, [refreshProperties]);

    return (
        <div className="grid gap-6">
            {properties.map((property) => (
                <PropertyCard
                    key={property.id}
                    property={property}
                    thingId={thingId}
                    onUpdate={refreshProperties}
                    inAlert={alertMap[property.id] ?? false}
                    recordingConfig={initialRecordingConfigMap[property.id]}
                    globalDecimalPlaces={globalDecimalPlaces}
                    propertyDecimalPlacesMap={propertyDecimalPlacesMap}
                />
            ))}
        </div>
    );
} 
