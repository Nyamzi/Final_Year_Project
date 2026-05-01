export const AUTH_COOKIE = "banking_sim_token";

export type UserRole = "parent" | "child" | "admin";

export type AuthTokenPayload = {
  userId: string;
  role: UserRole;
  email: string;
};
