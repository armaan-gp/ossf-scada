

// eslint-disable-next-line
const ArduinoIoTClient = require('@arduino/arduino-iot-client');



// Interfaces
interface AccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface Device {
  href: string;
  id: string;
  label: string;
  name: string;
  serial: string;
  type: string;
  user_id: string;
  connection_type?: string;
  created_at: string;
  device_status: string;
  events?: any[];
  fqbn?: string;
  last_activity_at?: string;
  ota_available?: boolean;
  ota_compatible?: boolean;
  thing?: Thing;
}

interface Thing {
  href: string;
  id: string;
  name: string;
  timezone: string;
  user_id: string;
  created_at: string;
  device_fqbn?: string;
  device_id?: string;
  device_name?: string;
  device_type?: string;
  properties?: any[];
  properties_count?: number;
  sketch_id?: string;
  updated_at?: string;
  webhook_active?: boolean;
}

export class ArduinoApiRequestError extends Error {
  status: number;
  statusText: string;
  responseBody: string;

  constructor(message: string, status: number, statusText: string, responseBody: string) {
    super(message);
    this.name = "ArduinoApiRequestError";
    this.status = status;
    this.statusText = statusText;
    this.responseBody = responseBody;
  }
}

export function isArduinoUnauthorizedError(error: unknown): error is ArduinoApiRequestError {
  return error instanceof ArduinoApiRequestError && error.status === 401;
}

// Function to obtain a fresh access token
async function getToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.ARDUINO_API_CLIENT_ID!,
    client_secret: process.env.ARDUINO_API_CLIENT_SECRET!,
    audience: 'https://api2.arduino.cc/iot',
  });

  const response = await fetch('https://api2.arduino.cc/iot/v1/clients/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    throw new ArduinoApiRequestError(
      `Failed to obtain access token: ${response.statusText}`,
      response.status,
      response.statusText,
      responseBody
    );
  }

  const data: AccessTokenResponse = await response.json();
  return data.access_token;
}

// Function to get all devices
async function getDevices(): Promise<Device[]> {
  const accessToken = await getToken();

  const apiClient = ArduinoIoTClient.ApiClient.instance;
  apiClient.authentications['oauth2'].accessToken = accessToken;

  const devicesApi = new ArduinoIoTClient.DevicesV2Api(apiClient);
  return devicesApi.devicesV2List();
}

// Function to get a specific device
async function getDevice(deviceId: string): Promise<Device> {
  const accessToken = await getToken();

  const apiClient = ArduinoIoTClient.ApiClient.instance;
  apiClient.authentications['oauth2'].accessToken = accessToken;

  const devicesApi = new ArduinoIoTClient.DevicesV2Api(apiClient);
  return devicesApi.devicesV2Show(deviceId);
}

// Function to get a specific thing
async function getThing(thingId: string): Promise<Thing> {
  const accessToken = await getToken();

  const apiClient = ArduinoIoTClient.ApiClient.instance;
  apiClient.authentications['oauth2'].accessToken = accessToken;

  const thingsApi = new ArduinoIoTClient.ThingsV2Api(apiClient);
  return thingsApi.thingsV2Show(thingId);
}

// Add this new function before the exports
async function updateProperty(thingId: string, propertyId: string, value: any): Promise<any> {
  const accessToken = await getToken();

  const apiClient = ArduinoIoTClient.ApiClient.instance;
  apiClient.authentications['oauth2'].accessToken = accessToken;

  const propertiesApi = new ArduinoIoTClient.PropertiesV2Api(apiClient);
  return propertiesApi.propertiesV2Publish(thingId, propertyId, { value });
}

export { getDevices, getDevice, getThing, updateProperty };
