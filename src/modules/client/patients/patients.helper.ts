import { Patient } from '@/public/patients/entities/patient.entity';
import { IsNull } from 'typeorm';
import { differenceInYears } from 'date-fns';

export function areNamesSimilar(
  nameA: string,
  nameB: string,
  threshold = 0.7,
): boolean {
  if (!nameA || !nameB) return false;

  // Normalize
  const a = normalizeName(nameA);
  const b = normalizeName(nameB);

  if (a === b) return true;

  const distance = levenshteinDistance(a, b);
  const similarity = 1 - distance / Math.max(a.length, b.length);

  return similarity >= threshold;
}

/* ---------- Helpers ---------- */

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z\s]/g, '');
}

function levenshteinDistance(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;

  // Swap to reduce memory
  if (lenA > lenB) [a, b] = [b, a];

  let prev = new Array(b.length + 1).fill(0);
  let curr = new Array(b.length + 1).fill(0);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length];
}

export function formatPatient(patient: Patient) {
  return {
    id: patient.id,
    userId: patient.user_id,
    name: patient.user?.name,
    email: patient.user?.email,
    phone: patient.user?.phone ?? null,
    age: calculateAge(patient.dob),
    gender: patient.gender,
    address: patient.address,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
  };
}

export function calculateAge(dob: string | Date): number {
  const birthDate = new Date(dob);
  const age = differenceInYears(new Date(), birthDate);
  return age;
}

export const queryDeletedPatient = { user: { deletedAt: IsNull() } };
