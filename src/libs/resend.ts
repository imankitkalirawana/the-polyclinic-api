import { Resend } from 'resend';

/**
 * Creates a Resend instance with the configured base URL
 * The Resend SDK automatically reads from process.env.RESEND_BASE_URL
 * Configure this via RESEND_BASE_URL environment variable
 *
 * @param apiKey - The Resend API key (optional, can also be set via RESEND_API_KEY env var)
 * @returns Resend instance configured to use the local FreeResend server
 */
export function createResend(apiKey?: string) {
  return new Resend(apiKey);
}

// Export a default instance if API key is available
export const resend = createResend(process.env.RESEND_API_KEY);
