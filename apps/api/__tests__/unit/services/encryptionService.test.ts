import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  EncryptionService,
  resetEncryptionService,
} from "../../../src/services/encryptionService";

describe("EncryptionService", () => {
  let encryptionService: EncryptionService;
  const testPassword = "test-password-123";
  const testSalt = Buffer.from(
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "hex"
  );

  beforeEach(async () => {
    // Reset the singleton before each test
    resetEncryptionService();
    encryptionService = new EncryptionService(testPassword, testSalt);
    await encryptionService.waitForInitialization();
  });

  afterEach(() => {
    resetEncryptionService();
  });

  describe("Basic encryption/decryption", () => {
    it("should encrypt and decrypt a string correctly", async () => {
      const plaintext = "Hello, World!";

      const encrypted = await encryptionService.encrypt(plaintext);
      expect(encrypted.encryptedData).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.authTag).toBeTruthy();
      expect(encrypted.keyId).toBe("default");

      const decrypted = await encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should handle empty strings", async () => {
      await expect(encryptionService.encrypt("")).rejects.toThrow(
        "Plaintext cannot be empty"
      );
    });

    it("should handle sensitive data", async () => {
      const sensitiveData = "IBAN: DE89370400440532013000";

      const encrypted = await encryptionService.encrypt(sensitiveData);
      const decrypted = await encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(sensitiveData);
      expect(encrypted.encryptedData).not.toContain("DE89370400440532013000");
    });

    it("should produce different encrypted outputs for the same input", async () => {
      const plaintext = "test data";

      const encrypted1 = await encryptionService.encrypt(plaintext);
      const encrypted2 = await encryptionService.encrypt(plaintext);

      // Different IVs should produce different encrypted data
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);

      // But both should decrypt to the same plaintext
      expect(await encryptionService.decrypt(encrypted1)).toBe(plaintext);
      expect(await encryptionService.decrypt(encrypted2)).toBe(plaintext);
    });
  });

  describe("Key management", () => {
    it("should support multiple encryption keys", async () => {
      await encryptionService.addKey("key2", "different-password");
      expect(await encryptionService.getAvailableKeys()).toContain("key2");
      expect(await encryptionService.isKeyActive("key2")).toBe(true);
    });

    it("should encrypt with different keys", async () => {
      await encryptionService.addKey("key2", "different-password");
      const plaintext = "test with different keys";

      const encrypted1 = await encryptionService.encrypt(plaintext);
      expect(encrypted1.keyId).toBe("default");

      await encryptionService.setActiveKey("key2");

      const encrypted2 = await encryptionService.encrypt(plaintext);
      expect(encrypted2.keyId).toBe("key2");

      // Both should decrypt correctly
      expect(await encryptionService.decrypt(encrypted1)).toBe(plaintext);
      expect(await encryptionService.decrypt(encrypted2)).toBe(plaintext);
    });

    it("should support key rotation", async () => {
      const plaintext = "test key rotation";
      const encrypted1 = await encryptionService.encrypt(plaintext);

      const newKeyId = await encryptionService.rotateKey("new-master-password");
      expect(await encryptionService.getCurrentKeyId()).toBe(newKeyId);

      const encrypted2 = await encryptionService.encrypt(plaintext);

      // Old encrypted data should still be decryptable
      expect(await encryptionService.decrypt(encrypted1)).toBe(plaintext);
      expect(await encryptionService.decrypt(encrypted2)).toBe(plaintext);

      // New encryption should use the new key
      expect(encrypted2.keyId).toBe(newKeyId);
      expect(encrypted1.keyId).not.toBe(encrypted2.keyId);
    });
  });

  describe("Error handling", () => {
    it("should handle invalid decryption data", async () => {
      const invalidData = {
        encryptedData: "invalid",
        iv: "invalid",
        authTag: "invalid",
        keyId: "default",
      };

      await expect(encryptionService.decrypt(invalidData)).rejects.toThrow(
        "Decryption failed"
      );
    });

    it("should handle missing required fields", async () => {
      const invalidData = {
        encryptedData: "",
        iv: "",
        authTag: "",
        keyId: "",
      };

      await expect(encryptionService.decrypt(invalidData)).rejects.toThrow(
        "Invalid decryption input: missing required fields"
      );
    });

    it("should handle non-existent key for encryption", async () => {
      await expect(
        encryptionService.encrypt("test", "nonexistent")
      ).rejects.toThrow("Encryption key with ID nonexistent not found");
    });

    it("should handle non-existent key for decryption", async () => {
      await expect(
        encryptionService.decrypt({
          encryptedData: "test",
          iv: "test",
          authTag: "test",
          keyId: "nonexistent",
        })
      ).rejects.toThrow("Decryption key with ID nonexistent not found");
    });
  });

  describe("Utility methods", () => {
    it("should handle null/empty values correctly", async () => {
      expect(await encryptionService.encryptIfNotEmpty(null)).toBeNull();
      expect(await encryptionService.encryptIfNotEmpty("")).toBeNull();
      expect(await encryptionService.encryptIfNotEmpty("   ")).toBeNull();

      const result = await encryptionService.encryptIfNotEmpty("test");
      expect(result).not.toBeNull();
      expect(result!.encryptedData).toBeTruthy();
    });

    it("should decrypt null values correctly", async () => {
      expect(await encryptionService.decryptIfNotNull(null)).toBeNull();

      const encrypted = await encryptionService.encrypt("test");
      const decrypted = await encryptionService.decryptIfNotNull(encrypted);
      expect(decrypted).toBe("test");
    });
  });

  describe("Authentication tag verification", () => {
    it("should detect tampered encrypted data", async () => {
      const plaintext = "sensitive data";
      const encrypted = await encryptionService.encrypt(plaintext);

      // Tamper with the encrypted data
      const tamperedData = {
        ...encrypted,
        encryptedData: encrypted.encryptedData.slice(0, -2) + "00",
      };

      await expect(encryptionService.decrypt(tamperedData)).rejects.toThrow(
        "Decryption failed"
      );
    });

    it("should detect tampered auth tag", async () => {
      const plaintext = "sensitive data";
      const encrypted = await encryptionService.encrypt(plaintext);

      // Tamper with the auth tag
      const tamperedData = {
        ...encrypted,
        authTag: encrypted.authTag.slice(0, -2) + "00",
      };

      await expect(encryptionService.decrypt(tamperedData)).rejects.toThrow(
        "Decryption failed"
      );
    });
  });

  describe("Large data handling", () => {
    it("should handle large amounts of data", async () => {
      const largeData = "x".repeat(10000);

      const encrypted = await encryptionService.encrypt(largeData);
      const decrypted = await encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(largeData);
      expect(decrypted.length).toBe(10000);
    });
  });

  describe("Key derivation consistency", () => {
    it("should produce consistent keys from same password and salt", async () => {
      const password = "test-password";
      const salt = Buffer.from("consistent-salt", "utf8");

      const service1 = new EncryptionService(password, salt);
      const service2 = new EncryptionService(password, salt);

      await service1.waitForInitialization();
      await service2.waitForInitialization();

      const plaintext = "consistency test";
      const encrypted1 = await service1.encrypt(plaintext);

      // Service2 should be able to decrypt what service1 encrypted
      expect(await service2.decrypt(encrypted1)).toBe(plaintext);
    });
  });
});
