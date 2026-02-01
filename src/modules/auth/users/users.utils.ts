export function getNameFromEmail(email: string): string {
  if (!email || !email.includes('@')) return 'User';

  const localPart = email.split('@')[0].split('+')[0].toLowerCase();

  const cleaned = localPart.replace(/^[^a-z]+/, '');

  const parts = cleaned.split(/[^a-z]+/).filter(Boolean);

  if (parts.length === 0) return 'User';

  const name = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return name || 'User';
}

export const generatePassword = (len = 16) =>
  Array.from({ length: len }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'.charAt(
      Math.floor(Math.random() * 85),
    ),
  ).join('');
