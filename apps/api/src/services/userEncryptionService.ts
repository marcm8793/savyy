import { User } from "../../db/schema";
import {
  getEncryptionService,
  type DecryptionInput,
} from "./encryptionService";
import { encryptedFieldToResult } from "../types/encryption";

export class UserEncryptionService {
  private encryptionService = getEncryptionService();

  /**
   * Decrypt user's email from encrypted fields
   */
  async decryptUserEmail(user: User): Promise<string | null> {
    if (
      !user.encryptedEmail ||
      !user.encryptedEmailIv ||
      !user.encryptedEmailAuthTag ||
      !user.encryptionKeyId
    ) {
      return null;
    }

    try {
      const encryptedData = encryptedFieldToResult({
        encryptedData: user.encryptedEmail,
        iv: user.encryptedEmailIv,
        authTag: user.encryptedEmailAuthTag,
        keyId: user.encryptionKeyId,
      });

      if (!encryptedData) {
        console.error(`🔓 Failed to create encrypted data object`);
        return null;
      }

      console.log(`🔓 Calling encryption service decrypt...`);
      const decryptedEmail = await this.encryptionService.decrypt(
        encryptedData as DecryptionInput
      );
      console.log(`🔓 Successfully decrypted email: ${decryptedEmail}`);
      return decryptedEmail;
    } catch (error) {
      console.error(`🔓 Failed to decrypt email for user ${user.id}:`, error);
      return null;
    }
  }

  /**
   * Decrypt user's Tink user ID from encrypted fields
   */
  async decryptTinkUserId(user: User): Promise<string | null> {
    if (
      !user.encryptedTinkUserId ||
      !user.encryptedTinkUserIdIv ||
      !user.encryptedTinkUserIdAuthTag ||
      !user.encryptionKeyId
    ) {
      return user.tinkUserId;
    }

    try {
      const encryptedData = encryptedFieldToResult({
        encryptedData: user.encryptedTinkUserId,
        iv: user.encryptedTinkUserIdIv,
        authTag: user.encryptedTinkUserIdAuthTag,
        keyId: user.encryptionKeyId,
      });

      if (!encryptedData) {
        return user.tinkUserId;
      }

      return await this.encryptionService.decrypt(
        encryptedData as DecryptionInput
      );
    } catch (error) {
      console.error(
        `Failed to decrypt Tink user ID for user ${user.id}:`,
        error
      );
      return user.tinkUserId;
    }
  }

  /**
   * Prepare user data for frontend consumption
   * Decrypts sensitive fields and removes encryption metadata
   */
  async prepareUserForFrontend(
    user: User
  ): Promise<
    Omit<
      User,
      | "encryptedEmail"
      | "encryptedEmailIv"
      | "encryptedEmailAuthTag"
      | "encryptedTinkUserId"
      | "encryptedTinkUserIdIv"
      | "encryptedTinkUserIdAuthTag"
      | "encryptionKeyId"
    >
  > {
    const decryptedEmail = await this.decryptUserEmail(user);
    const decryptedTinkUserId = await this.decryptTinkUserId(user);

    // Create a new object without encryption fields
    const userWithoutEncryption = {
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: decryptedEmail || "Email unavailable", // Don't show hash, show meaningful message
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      tinkUserId: decryptedTinkUserId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return userWithoutEncryption;
  }
}

export const userEncryptionService = new UserEncryptionService();
