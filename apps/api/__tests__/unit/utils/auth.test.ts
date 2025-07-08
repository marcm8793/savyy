import { describe, it, expect } from "vitest";
import { splitNameWithFallbacks } from "../../../src/utils/auth";

describe("auth utils", () => {
  describe("splitNameWithFallbacks", () => {
    it("should split full name correctly", () => {
      const result = splitNameWithFallbacks("John Doe", null);
      expect(result).toEqual({
        firstName: "John",
        lastName: "Doe",
      });
    });

    it("should handle single name", () => {
      const result = splitNameWithFallbacks("John", null);
      expect(result).toEqual({
        firstName: "John",
        lastName: "Account",
      });
    });

    it("should handle multiple last names", () => {
      const result = splitNameWithFallbacks("John Van Der Berg", null);
      expect(result).toEqual({
        firstName: "John",
        lastName: "Van Der Berg",
      });
    });

    it("should fallback to existing names when no new name provided", () => {
      const result = splitNameWithFallbacks(null, null, "Existing", "User");
      expect(result).toEqual({
        firstName: "Existing",
        lastName: "User",
      });
    });

    it("should extract name from email when no name provided", () => {
      const result = splitNameWithFallbacks(null, "john.doe@example.com");
      expect(result).toEqual({
        firstName: "john.doe",
        lastName: "Account",
      });
    });

    it("should use default values when nothing provided", () => {
      const result = splitNameWithFallbacks(null, null);
      expect(result).toEqual({
        firstName: "User",
        lastName: "Account",
      });
    });

    it("should prioritize new name over existing", () => {
      const result = splitNameWithFallbacks("New Name", null, "Old", "Name");
      expect(result).toEqual({
        firstName: "New",
        lastName: "Name",
      });
    });
  });
});
