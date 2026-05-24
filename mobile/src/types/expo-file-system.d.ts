declare module 'expo-file-system' {
  export enum EncodingType {
    UTF8 = 'utf8',
    Base64 = 'base64',
  }

  export const EncodingType: {
    UTF8: EncodingType;
    Base64: EncodingType;
  };

  export function readAsStringAsync(
    uri: string,
    options?: { encoding?: EncodingType }
  ): Promise<string>;

  export function getInfoAsync(
    uri: string
  ): Promise<{ exists: boolean; size?: number; uri?: string }>;

  export const documentDirectory: string | null;

  export function downloadAsync(
    uri: string,
    fileUri: string
  ): Promise<{ uri: string; status?: number }>;
}
