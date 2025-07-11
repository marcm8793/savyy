import { User } from "../../db/schema";
import {
  getEncryptionService,
  type DecryptionInput,
} from "./encryptionService";
import { encryptedFieldToResult } from "../types/encryption";

export class UserEncryptionService {
  private encryptionService = getEncryptionService();

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
      | "encryptedTinkUserId"
      | "encryptedTinkUserIdIv"
      | "encryptedTinkUserIdAuthTag"
      | "encryptionKeyId"
    >
  > {
    const decryptedTinkUserId = await this.decryptTinkUserId(user);

    // Create a new object without encryption fields
    const userWithoutEncryption = {
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
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
