import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { user, schema, User } from "../../db/schema";

export class UserService {
  /**
   * Update user's Tink user ID
   */
  async updateTinkUserId(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    tinkUserId: string
  ): Promise<User> {
    const result = await db
      .update(user)
      .set({
        tinkUserId,
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
}

export const userService = new UserService();
