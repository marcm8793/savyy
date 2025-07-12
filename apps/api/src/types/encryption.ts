import { EncryptionResult } from "../services/encryptionService";

export interface EncryptedField {
  encryptedData: string | null;
  iv: string | null;
  authTag: string | null;
  keyId: string | null;
}

export interface EncryptedUser {
  encryptedTinkUserId: string | null;
  encryptedTinkUserIdIv: string | null;
  encryptedTinkUserIdAuthTag: string | null;
  encryptionKeyId: string | null;
}

export interface EncryptedAccount {
  encryptedAccessToken: string | null;
  encryptedAccessTokenIv: string | null;
  encryptedAccessTokenAuthTag: string | null;
  encryptedRefreshToken: string | null;
  encryptedRefreshTokenIv: string | null;
  encryptedRefreshTokenAuthTag: string | null;
  encryptedIdToken: string | null;
  encryptedIdTokenIv: string | null;
  encryptedIdTokenAuthTag: string | null;
  encryptionKeyId: string | null;
}

export interface EncryptedBankAccount {
  encryptedIban: string | null;
  encryptedIbanIv: string | null;
  encryptedIbanAuthTag: string | null;
  encryptedAccessToken: string | null;
  encryptedAccessTokenIv: string | null;
  encryptedAccessTokenAuthTag: string | null;
  encryptionKeyId: string | null;
}

export interface EncryptedTransaction {
  encryptedPayeeAccountNumber: string | null;
  encryptedPayeeAccountNumberIv: string | null;
  encryptedPayeeAccountNumberAuthTag: string | null;
  encryptedPayerAccountNumber: string | null;
  encryptedPayerAccountNumberIv: string | null;
  encryptedPayerAccountNumberAuthTag: string | null;
  encryptionKeyId: string | null;
}

export function encryptionResultToFields(result: EncryptionResult | null): EncryptedField {
  if (!result) {
    return {
      encryptedData: null,
      iv: null,
      authTag: null,
      keyId: null,
    };
  }

  return {
    encryptedData: result.encryptedData,
    iv: result.iv,
    authTag: result.authTag,
    keyId: result.keyId,
  };
}

export function encryptedFieldToResult(field: EncryptedField): EncryptionResult | null {
  if (!field.encryptedData || !field.iv || !field.authTag || !field.keyId) {
    return null;
  }

  return {
    encryptedData: field.encryptedData,
    iv: field.iv,
    authTag: field.authTag,
    keyId: field.keyId,
  };
}