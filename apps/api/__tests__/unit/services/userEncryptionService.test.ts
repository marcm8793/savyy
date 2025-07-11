import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserEncryptionService } from "../../../src/services/userEncryptionService";
import { User } from "../../../db/schema";

// Mock the encryption service
vi.mock("../../../src/services/encryptionService", () => ({
  getEncryptionService: () => ({
    decrypt: vi.fn(async (data) => {
      if (data.encryptedData === "encrypted_tink_id") {
        return "decrypted_tink_123";
      }
      throw new Error("Decryption failed");
    }),
  }),
}));

describe("UserEncryptionService", () => {
  let userEncryptionService: UserEncryptionService;
  let mockUser: User;

  beforeEach(() => {
    userEncryptionService = new UserEncryptionService();

    mockUser = {
      id: "user123",
      name: "John Doe",
      firstName: "John",
      lastName: "Doe",
      email: "test@example.com",
      emailVerified: true,
      image: null,
      role: "user",
      tinkUserId: "original_tink_123",
      encryptedTinkUserId: "encrypted_tink_id",
      encryptedTinkUserIdIv: "tink_iv",
      encryptedTinkUserIdAuthTag: "tink_auth_tag",
      encryptionKeyId: "key123",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
  });


  describe("decryptTinkUserId", () => {
    it("should decrypt Tink user ID when encrypted fields are present", async () => {
      const result = await userEncryptionService.decryptTinkUserId(mockUser);
      expect(result).toBe("decrypted_tink_123");
    });

    it("should fallback to plain Tink user ID when encrypted fields are missing", async () => {
      const userWithoutEncryption = {
        ...mockUser,
        encryptedTinkUserId: null,
        encryptedTinkUserIdIv: null,
        encryptedTinkUserIdAuthTag: null,
        encryptionKeyId: null,
      };

      const result = await userEncryptionService.decryptTinkUserId(
        userWithoutEncryption
      );
      expect(result).toBe("original_tink_123");
    });
  });

  describe("prepareUserForFrontend", () => {
    it("should return user data with decrypted fields and without encryption metadata", async () => {
      const result = await userEncryptionService.prepareUserForFrontend(
        mockUser
      );

      expect(result).toEqual({
        id: "user123",
        name: "John Doe",
        firstName: "John",
        lastName: "Doe",
        email: "test@example.com",
        emailVerified: true,
        image: null,
        role: "user",
        tinkUserId: "decrypted_tink_123",
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });

      // Ensure encryption fields are not present
      expect(result).not.toHaveProperty("encryptedTinkUserId");
      expect(result).not.toHaveProperty("encryptedTinkUserIdIv");
      expect(result).not.toHaveProperty("encryptedTinkUserIdAuthTag");
      expect(result).not.toHaveProperty("encryptionKeyId");
    });
  });
});
