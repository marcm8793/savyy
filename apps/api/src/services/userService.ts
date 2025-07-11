import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { user, schema, User } from "../../db/schema";
import { splitNameWithFallbacks } from "../utils/auth";
import { getEncryptionService } from "./encryptionService";
import { encryptionResultToFields } from "../types/encryption";

export class UserService {
  /**
   * Update user's Tink user ID
   */
  async updateTinkUserId(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    tinkUserId: string
  ): Promise<User> {
    // Initialize encryption service
    const encryptionService = getEncryptionService();
    await encryptionService.waitForInitialization();

    // Encrypt the Tink user ID
    const encryptedTinkUserId = await encryptionService.encrypt(tinkUserId);
    const tinkUserIdFields = encryptionResultToFields(encryptedTinkUserId);

    const result = await db
      .update(user)
      .set({
        tinkUserId,
        encryptedTinkUserId: tinkUserIdFields.encryptedData,
        encryptedTinkUserIdIv: tinkUserIdFields.iv,
        encryptedTinkUserIdAuthTag: tinkUserIdFields.authTag,
        encryptionKeyId: tinkUserIdFields.keyId,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId))
      .returning();

    if (result.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }

    return result[0];
  }

  /**
   * Get user by ID
   */
  async getUserById(
    db: NodePgDatabase<typeof schema>,
    userId: string
  ): Promise<User | null> {
    const result = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get user's Tink user ID
   */
  async getTinkUserId(
    db: NodePgDatabase<typeof schema>,
    userId: string
  ): Promise<string | null> {
    const result = await db
      .select({ tinkUserId: user.tinkUserId })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    return result[0]?.tinkUserId || null;
  }

  /**
   * Update user profile with firstName/lastName
   */
  async updateUserProfile(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      name?: string;
    }
  ): Promise<User> {
    // Get current user data for fallbacks
    const currentUser = await this.getUserById(db, userId);
    if (!currentUser) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Use the utility function for consistent name handling
    const { firstName, lastName } = splitNameWithFallbacks(
      updates.name,
      currentUser.email,
      updates.firstName ?? currentUser.firstName,
      updates.lastName ?? currentUser.lastName
    );

    // Prepare the update data
    const updateData: {
      firstName: string;
      lastName: string;
      name: string;
      updatedAt: Date;
    } = {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      updatedAt: new Date(),
    };

    const result = await db
      .update(user)
      .set(updateData)
      .where(eq(user.id, userId))
      .returning();

    if (result.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }

    return result[0];
  }

  /**
   * Update user's name and sync firstName/lastName
   */
  async updateUserName(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    name: string
  ): Promise<User> {
    return this.updateUserProfile(db, userId, { name });
  }
}

export const userService = new UserService();
