interface TinkCreateUserRequest {
  external_user_id?: string;
  locale?: string;
  market: string;
}

interface TinkCreateUserResponse {
  external_user_id: string;
  user_id: string;
}

interface TinkNotificationSettings {
  balance: boolean;
  budget: boolean;
  doubleCharge: boolean;
  einvoices: boolean;
  fraud: boolean;
  income: boolean;
  largeExpense: boolean;
  leftToSpend: boolean;
  loanUpdate: boolean;
  summaryMonthly: boolean;
  summaryWeekly: boolean;
  transaction: boolean;
  unusualAccount: boolean;
  unusualCategory: boolean;
}

type PeriodMode = "MONTHLY" | "MONTHLY_ADJUSTED";

interface TinkUserProfile {
  currency: string; // readonly - ISO 4217 currency code
  locale: string;
  market: string; // readonly - primary market/country
  notificationSettings: TinkNotificationSettings;
  periodAdjustedDay: number; // 1-31
  periodMode: PeriodMode;
  timeZone: string;
}

interface TinkUser {
  appId: string; // readonly
  created: Date | string; // readonly - Date when the user was created
  externalUserId?: string; // optional - external identifier
  flags: string[]; // readonly - user-specific feature flags
  id: string; // readonly - globally unique identifier
  nationalId?: string; // readonly - detected national identification number
  profile: TinkUserProfile; // readonly except for modifiable fields
  username?: string; // optional - only for older integrations
}

interface TinkUpdateUserRequest {
  externalUserId?: string;
  username?: string;
}

interface TinkUpdateUserProfileRequest {
  locale?: string;
  notificationSettings?: Partial<TinkNotificationSettings>;
  periodAdjustedDay?: number; // 1-31
  periodMode?: PeriodMode;
  timeZone?: string;
}

export class TinkUserService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.TINK_BASE_URL || "";
    if (!this.baseUrl) {
      throw new Error("TINK_BASE_URL environment variable is required");
    }
  }

  /**
   * Create a new user in Tink
   * Uses client access token with user:create scope
   */
  async createUser(
    clientAccessToken: string,
    externalUserId?: string,
    market: string = "FR",
    locale: string = "en_US"
  ): Promise<TinkCreateUserResponse> {
    const requestBody: TinkCreateUserRequest = {
      market,
      locale,
    };

    if (externalUserId) {
      requestBody.external_user_id = externalUserId;
    }

    const response = await fetch(`${this.baseUrl}/api/v1/user/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tink create user error:", errorText);
      throw new Error(`Failed to create user: ${response.status} ${errorText}`);
    }

    const userData = (await response.json()) as TinkCreateUserResponse;
    console.log("Tink create user success:", {
      tinkUserId: userData.user_id,
      externalUserId: userData.external_user_id,
    });

    return userData;
  }

  /**
   * Delete the authenticated user
   * Uses user access token with user:delete scope
   */
  async deleteUser(userAccessToken: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/user/delete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tink delete user error:", errorText);
      throw new Error(`Failed to delete user: ${response.status} ${errorText}`);
    }

    console.log("Tink delete user success");
  }

  /**
   * Get the authenticated user
   * Uses user access token with user:read scope
   */
  async getUser(userAccessToken: string): Promise<TinkUser> {
    const response = await fetch(`${this.baseUrl}/api/v1/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tink get user error:", errorText);
      throw new Error(`Failed to get user: ${response.status} ${errorText}`);
    }

    const userData = (await response.json()) as TinkUser;
    console.log("Tink get user success:", {
      userId: userData.id,
      externalUserId: userData.externalUserId,
    });

    return userData;
  }

  /**
   * Get the authenticated user's profile
   * Uses user access token with user:read scope
   */
  async getUserProfile(userAccessToken: string): Promise<TinkUserProfile> {
    const response = await fetch(`${this.baseUrl}/api/v1/user/profile`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tink get user profile error:", errorText);
      throw new Error(
        `Failed to get user profile: ${response.status} ${errorText}`
      );
    }

    const profileData = (await response.json()) as TinkUserProfile;
    console.log("Tink get user profile success:", {
      market: profileData.market,
      locale: profileData.locale,
      currency: profileData.currency,
    });

    return profileData;
  }

  /**
   * Update the authenticated user
   * Uses user access token with user:write scope
   */
  async updateUser(
    userAccessToken: string,
    updateData: TinkUpdateUserRequest
  ): Promise<TinkUser> {
    const response = await fetch(`${this.baseUrl}/api/v1/user`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tink update user error:", errorText);
      throw new Error(`Failed to update user: ${response.status} ${errorText}`);
    }

    const userData = (await response.json()) as TinkUser;
    console.log("Tink update user success:", {
      userId: userData.id,
      externalUserId: userData.externalUserId,
      username: userData.username,
    });

    return userData;
  }

  /**
   * Update the authenticated user's profile
   * Uses user access token with user:write scope
   */
  async updateUserProfile(
    userAccessToken: string,
    updateData: TinkUpdateUserProfileRequest
  ): Promise<TinkUserProfile> {
    // Validate periodAdjustedDay if provided
    if (updateData.periodAdjustedDay !== undefined) {
      if (
        updateData.periodAdjustedDay < 1 ||
        updateData.periodAdjustedDay > 31
      ) {
        throw new Error("periodAdjustedDay must be between 1 and 31");
      }
    }

    const response = await fetch(`${this.baseUrl}/api/v1/user/profile`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tink update user profile error:", errorText);
      throw new Error(
        `Failed to update user profile: ${response.status} ${errorText}`
      );
    }

    const profileData = (await response.json()) as TinkUserProfile;
    console.log("Tink update user profile success:", {
      market: profileData.market,
      locale: profileData.locale,
      currency: profileData.currency,
    });

    return profileData;
  }
}
