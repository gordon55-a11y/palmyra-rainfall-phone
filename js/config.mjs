/**
 * Public Application (client) ID already used by the cattle phone.
 * This is not a password. Do not put a client secret here.
 */
export const MICROSOFT_CLIENT_ID = "f19bbd77-5a5c-4c7b-b101-325509b786f6";

/**
 * Personal Microsoft accounts. The cattle page uses "common" because that
 * registration also allows work accounts. This page asks for personal
 * accounts. If sign-in says the app was not found, change this one line
 * to https://login.microsoftonline.com/common
 */
export const MICROSOFT_AUTHORITY = "https://login.microsoftonline.com/consumers";

export const MICROSOFT_SCOPES = ["User.Read", "Files.ReadWrite"];
