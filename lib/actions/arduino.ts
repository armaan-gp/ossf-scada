"use server";

import { getDevices, getDevice, getThing, updateProperty, type ThingProperty } from "@/lib/arduinoInit";
import { revalidatePath } from "next/cache";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error";
}

// Server action to fetch all devices
export async function fetchDevices() {
  try {
    const devices = await getDevices();
    return { success: true, data: devices };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

// Server action to fetch a specific device by ID
export async function fetchDevice(deviceId: string) {
  try {
    const device = await getDevice(deviceId);
    return { success: true, data: device };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

// Server action to fetch a specific thing by ID
export async function fetchThing(thingId: string) {
  try {
    const thing = await getThing(thingId);
    // Serialize the data before returning
    return { success: true, data: JSON.parse(JSON.stringify(thing)) };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

// Server action to update a property value
export async function updateDeviceProperty(thingId: string, propertyId: string, value: unknown) {
  try {
    const result = await updateProperty(thingId, propertyId, value);
    revalidatePath('/app/device/[id]');
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

// Server action to fetch property value
export async function fetchPropertyValue(thingId: string, propertyId: string) {
  try {
    const thing = await getThing(thingId);
    const property = thing.properties?.find((p: ThingProperty) => p.id === propertyId);
    
    if (!property) {
      throw new Error("Property not found");
    }

    return { 
      success: true, 
      data: {
        value: property.last_value,
        updated_at: property.value_updated_at ?? null,
      }
    };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}
