// Firebase Storage path templates
export const getSharedFolderPath = (deviceId: string): string => {
  return `agents/${deviceId}/shared`;
};

export const getSharedFilePath = (deviceId: string, fileName: string): string => {
  return `agents/${deviceId}/shared/${fileName}`;
};
