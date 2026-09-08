/**
 * The services a medical center can offer.
 *
 * Previously this was a free-text "comma separated" field, which let the same
 * service arrive spelled several ways — the live database already holds both
 * `General Medicine` and a bare `General` — and made "which centers do
 * cardiology?" unanswerable without fuzzy matching.
 *
 * Spellings here deliberately match what is already stored (`Orthopedics`,
 * `Dental`, `Emergency`, `Surgery` — US spellings, short forms) so selecting
 * from the list produces values consistent with existing rows rather than
 * near-duplicates like `Orthopaedics`.
 *
 * Grouping is presentational only. What is saved to `medical_centers.services`
 * is a flat `string[]`, unchanged.
 */

export interface ServiceGroup {
  label: string
  services: string[]
}

export const SERVICE_GROUPS: ServiceGroup[] = [
  {
    label: 'Primary & Urgent Care',
    services: ['General Medicine', 'Emergency', 'Pediatrics', 'Family Medicine'],
  },
  {
    label: 'Medical Specialties',
    services: [
      'Cardiology',
      'Dermatology',
      'Endocrinology',
      'Gastroenterology',
      'Nephrology',
      'Neurology',
      'Oncology',
      'Pulmonology',
      'Rheumatology',
    ],
  },
  {
    label: 'Surgical',
    services: ['Surgery', 'Orthopedics', 'ENT', 'Ophthalmology', 'Urology', 'Neurosurgery'],
  },
  {
    label: "Women's & Children's Health",
    services: ['Gynecology', 'Maternity', 'Neonatology', 'Fertility'],
  },
  {
    label: 'Dental & Mental Health',
    services: ['Dental', 'Orthodontics', 'Psychiatry', 'Counselling'],
  },
  {
    label: 'Diagnostics',
    services: ['Laboratory', 'Radiology', 'ECG', 'Ultrasound Scanning', 'Endoscopy'],
  },
  {
    label: 'Therapy & Support',
    services: ['Physiotherapy', 'Nutrition', 'Vaccination', 'Pharmacy', 'Ayurveda'],
  },
]

/** Flat list of every known service, for lookups and "is this a custom entry?" checks. */
export const ALL_SERVICES: string[] = SERVICE_GROUPS.flatMap(group => group.services)

/**
 * Compared case-insensitively so a custom "cardiology" isn't stored alongside
 * the listed "Cardiology".
 */
export function findKnownService(value: string): string | undefined {
  const needle = value.trim().toLowerCase()
  return ALL_SERVICES.find(service => service.toLowerCase() === needle)
}
