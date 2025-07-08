import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  authTag: string;
  keyId: string;
}

export interface DecryptionInput {
  encryptedData: string;
  iv: string;
  authTag: string;
  keyId: string;
}

export interface EncryptionKey {
  id: string;
  key: Buffer;
  salt: Buffer;
  createdAt: Date;
  isActive: boolean;
}

export class EncryptionService {
  private keys: Map<string, EncryptionKey> = new Map();
  private currentKeyId: string | null = null;
  private readonly keyDerivationSalt: Buffer;
  private initializationPromise: Promise<void>;

  constructor(masterPassword: string, keyDerivationSalt: Buffer) {
    this.keyDerivationSalt = keyDerivationSalt;
    this.initializationPromise = this.initializeDefaultKey(masterPassword);
  }

  /**
   * Wait for the service to be fully initialized
   */
  async waitForInitialization(): Promise<void> {
    await this.initializationPromise;
  }

  private async initializeDefaultKey(masterPassword: string): Promise<void> {
    const keyId = "default";
    const derivedKey = await this.deriveKey(
      masterPassword,
      this.keyDerivationSalt
    );

    const key: EncryptionKey = {
      id: keyId,
      key: derivedKey,
      salt: this.keyDerivationSalt,
      createdAt: new Date(),
      isActive: true,
    };

    this.keys.set(keyId, key);
    this.currentKeyId = keyId;
  }

  private async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return (await scryptAsync(password, salt, 32)) as Buffer;
  }

  async addKey(
    keyId: string,
    masterPassword: string,
    salt: Buffer
  ): Promise<void> {
    await this.waitForInitialization();
    if (this.keys.has(keyId)) {
      throw new Error(`Key with ID ${keyId} already exists`);
    }
    const derivedKey = await this.deriveKey(masterPassword, salt);

    const key: EncryptionKey = {
      id: keyId,
      key: derivedKey,
      salt: salt,
      createdAt: new Date(),
      isActive: true,
    };

    this.keys.set(keyId, key);
  }

  async setActiveKey(keyId: string): Promise<void> {
    await this.waitForInitialization();
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Key with ID ${keyId} not found`);
    }
    if (!key.isActive) {
      throw new Error(`Key with ID ${keyId} is not active`);
    }
    this.currentKeyId = keyId;
  }

  async deactivateKey(keyId: string): Promise<void> {
    await this.waitForInitialization();
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Key with ID ${keyId} not found`);
    }
    if (keyId === this.currentKeyId) {
      throw new Error("Cannot deactivate the current active key");
    }
    key.isActive = false;
  }

  async encrypt(plaintext: string, keyId?: string): Promise<EncryptionResult> {
    await this.waitForInitialization();

    if (!plaintext) {
      throw new Error("Plaintext cannot be empty");
    }

    const useKeyId = keyId || this.currentKeyId;
    if (!useKeyId) {
      throw new Error("No active encryption key available");
    }

    const key = this.keys.get(useKeyId);
    if (!key) {
      throw new Error(`Encryption key with ID ${useKeyId} not found`);
    }
    if (!key.isActive) {
      throw new Error(`Encryption key with ID ${useKeyId} is not active`);
    }

    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-gcm", key.key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return {
      encryptedData: encrypted,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
      keyId: useKeyId,
    };
  }

  async decrypt(input: DecryptionInput): Promise<string> {
    await this.waitForInitialization();

    if (!input.encryptedData || !input.iv || !input.authTag || !input.keyId) {
      throw new Error("Invalid decryption input: missing required fields");
    }

    const key = this.keys.get(input.keyId);
    if (!key) {
      throw new Error(`Decryption key with ID ${input.keyId} not found`);
    }

    try {
      const iv = Buffer.from(input.iv, "hex");
      const authTag = Buffer.from(input.authTag, "hex");
      const encryptedData = input.encryptedData;

      const decipher = createDecipheriv("aes-256-gcm", key.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      throw new Error(
        `Decryption failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getAvailableKeys(): Promise<string[]> {
    await this.waitForInitialization();
    return Array.from(this.keys.keys());
  }

  async getCurrentKeyId(): Promise<string | null> {
    await this.waitForInitialization();
    return this.currentKeyId;
  }

  async isKeyActive(keyId: string): Promise<boolean> {
    await this.waitForInitialization();
    const key = this.keys.get(keyId);
    return key ? key.isActive : false;
  }

  async rotateKey(newMasterPassword: string, newSalt?: Buffer): Promise<string> {
    // Generate a collision-resistant key ID using timestamp, random bytes, and process ID
    const timestamp = Date.now();
    const randomPart = randomBytes(16).toString("hex");
    const processId = process.pid;
    const newKeyId = `key_${timestamp}_${processId}_${randomPart}`;

    const salt = newSalt || randomBytes(32);
    await this.addKey(newKeyId, newMasterPassword, salt);
    await this.setActiveKey(newKeyId);

    return newKeyId;
  }

  async encryptIfNotEmpty(
    value: string | null | undefined,
    keyId?: string
  ): Promise<EncryptionResult | null> {
    if (!value || value.trim() === "") {
      return null;
    }
    return this.encrypt(value, keyId);
  }

  async decryptIfNotNull(
    input: EncryptionResult | null
  ): Promise<string | null> {
    if (!input) {
      return null;
    }
    return this.decrypt(input);
  }
}

let encryptionServiceInstance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    const masterPassword = process.env.ENCRYPTION_MASTER_PASSWORD;
    if (!masterPassword) {
      throw new Error(
        "ENCRYPTION_MASTER_PASSWORD environment variable is required"
      );
    }

    const saltHex = process.env.ENCRYPTION_KEY_SALT;
    if (!saltHex) {
      throw new Error(
        "ENCRYPTION_KEY_SALT environment variable is required"
      );
    }
    const salt = Buffer.from(saltHex, "hex");

    encryptionServiceInstance = new EncryptionService(masterPassword, salt);
  }
  return encryptionServiceInstance;
}

export function resetEncryptionService(): void {
  encryptionServiceInstance = null;
}
