/**
 * Public Application (client) ID already used by the cattle phone.
 * This is not a password. Do not put a client secret here.
 */
export const MICROSOFT_CLIENT_ID = "f19bbd77-5a5c-4c7b-b101-325509b786f6";

/**
 * Same registration as the cattle phone. It was registered for work accounts
 * and personal Microsoft accounts, and that registration is found at "common".
 * A personal Microsoft account still signs in through "common".
 * "consumers" only finds apps registered as personal accounts only, so a
 * sign-in there does not stay signed in on the next open.
 */
export const MICROSOFT_AUTHORITY = "https://login.microsoftonline.com/common";

/**
 * Same scopes as the cattle phone. The Microsoft library adds offline_access
 * itself, which is what stores a refresh token. Do not list offline_access here.
 */
export const MICROSOFT_SCOPES = ["User.Read", "Files.ReadWrite"];
