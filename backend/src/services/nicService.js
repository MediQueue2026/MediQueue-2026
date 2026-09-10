/**
 * Sri Lankan NIC decoding.
 *
 * The Doctor Console used to render every patient as "Age 35 · Male" because
 * nothing in walk_in_queue carries a date of birth. It does carry the NIC, and
 * a Sri Lankan NIC encodes both birth date and sex, so these are real values
 * rather than placeholders. Anything unparseable returns nulls and the UI shows
 * a dash — fabricating a patient's age on a clinical screen is not acceptable.
 *
 * Old format (10 chars): YYDDDSSSSC   e.g. 198845210082 → no, that's new.
 *   '881234567V' → YY=88, DDD=123 (day of year), rest serial + letter.
 * New format (12 digits): YYYYDDDSSSSS
 *   '198812345678' → YYYY=1988, DDD=123.
 *
 * In both formats the day-of-year field has 500 added for females.
 */

/** The encoding always reserves 29 Feb, so February is 29 days for every year. */
const MONTH_LENGTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Parses a NIC into `{ birthDate, age, gender }`.
 * Returns `{ birthDate: null, age: null, gender: null }` for anything invalid.
 */
export function parseNic(nic) {
  const empty = { birthDate: null, age: null, gender: null };
  if (!nic || typeof nic !== 'string') return empty;

  const cleaned = nic.trim().toUpperCase().replace(/\s/g, '');

  let year;
  let dayField;

  if (/^\d{12}$/.test(cleaned)) {
    year = Number(cleaned.slice(0, 4));
    dayField = Number(cleaned.slice(4, 7));
  } else if (/^\d{9}[VX]$/.test(cleaned)) {
    const yy = Number(cleaned.slice(0, 2));
    // Old-format NICs were issued from the 1930s to 2015, so a two-digit year
    // is always 19xx — there is no 20xx old-format card to be ambiguous with.
    year = 1900 + yy;
    dayField = Number(cleaned.slice(2, 5));
  } else {
    return empty;
  }

  const gender = dayField > 500 ? 'Female' : 'Male';
  let dayOfYear = dayField > 500 ? dayField - 500 : dayField;

  // Day 0 and anything past the calendar means a malformed or dummy number.
  if (!Number.isFinite(dayOfYear) || dayOfYear < 1 || dayOfYear > 366) return empty;

  // The encoding always reserves 29 Feb, so month lengths are the leap-year set
  // regardless of whether the birth year was actually a leap year.
  let month = 0;
  let remaining = dayOfYear;
  while (month < 12 && remaining > MONTH_LENGTHS[month]) {
    remaining -= MONTH_LENGTHS[month];
    month += 1;
  }
  if (month > 11) return empty;

  const birthDate = new Date(Date.UTC(year, month, remaining));
  if (Number.isNaN(birthDate.getTime())) return empty;

  const now = new Date();
  let age = now.getUTCFullYear() - year;
  const hadBirthdayThisYear =
    now.getUTCMonth() > month || (now.getUTCMonth() === month && now.getUTCDate() >= remaining);
  if (!hadBirthdayThisYear) age -= 1;

  if (age < 0 || age > 120) return { birthDate: null, age: null, gender };

  return {
    birthDate: birthDate.toISOString().slice(0, 10),
    age,
    gender,
  };
}

/** 'Male' → 'M' for the compact queue rows. */
export function genderInitial(gender) {
  if (gender === 'Male') return 'M';
  if (gender === 'Female') return 'F';
  return null;
}
