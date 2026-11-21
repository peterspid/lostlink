import { customAlphabet } from "nanoid";

const alnum = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", 20);
const lowerAlnum = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 16);
// No 0/O/1/I/L so codes read cleanly off a phone screen or poster.
const codeChars = customAlphabet("23456789ABCDEFGHJKMNPQRSTUVWXYZ", 5);
const tokenChars = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", 32);

/** Internal primary key for DB rows. */
export const newId = () => lowerAlnum();

/** Human-readable reference code printed on items, e.g. "K7Q3F". */
export const newItemCode = () => codeChars();

/** Unguessable token for invite links. */
export const newToken = () => tokenChars();

/**
 * Nexconn user/channel ids: prefix + random alphanumeric (letters and digits only,
 * never sequential), as required by the shared App Key rules.
 */
export function nexconnId(prefix: string): string {
  return `${prefix}${alnum()}`;
}
