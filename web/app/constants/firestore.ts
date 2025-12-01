// Firestore collection names
export const FIRESTORE_COLLECTION_DEVICES = "devices";
export const FIRESTORE_COLLECTION_COMMANDS = "commands";

// Firestore path helpers - returns tuple of path segments for Firestore API
export const getCommandsCollectionPath = (deviceId: string): [string, string, string] => {
  return [FIRESTORE_COLLECTION_DEVICES, deviceId, FIRESTORE_COLLECTION_COMMANDS];
};

export const getCommandDocumentPath = (deviceId: string, commandId: string): [string, string, string, string] => {
  return [FIRESTORE_COLLECTION_DEVICES, deviceId, FIRESTORE_COLLECTION_COMMANDS, commandId];
};

export const getDeviceDocumentPath = (deviceId: string): [string, string] => {
  return [FIRESTORE_COLLECTION_DEVICES, deviceId];
};
