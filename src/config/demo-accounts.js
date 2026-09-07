// Demo identities are intentionally non-production credentials for evaluation.
// Keep this list in one place so the seed script and the development login helper
// cannot drift apart.
export const DEMO_ACCOUNTS = [
  {
    key: 'applicant',
    name: 'Asha Sharma',
    email: 'asha.applicant@demo.ip-sakti.in',
    password: 'DemoApplicant#2026',
    accountRole: 'applicant',
    roleLabel: 'Applicant / Innovator',
    membershipRole: 'owner',
    organizationName: 'Aarogyam Innovation Lab',
    organizationSlug: 'aarogyam-innovation-demo',
    description: 'Create product cases, classify formulations and prepare next actions.'
  },
  {
    key: 'professional',
    name: 'Dr. Vikram Mehta',
    email: 'vikram.professional@demo.ip-sakti.in',
    password: 'DemoProfessional#2026',
    accountRole: 'professional',
    roleLabel: 'IP Professional',
    membershipRole: 'agent',
    organizationName: 'Sanjivani IP Counsel',
    organizationSlug: 'sanjivani-ip-counsel-demo',
    description: 'Review escalated cases, evidence and client-ready action plans.'
  },
  {
    key: 'government',
    name: 'Ananya Rao',
    email: 'ananya.government@demo.ip-sakti.in',
    password: 'DemoGovernment#2026',
    accountRole: 'government',
    roleLabel: 'Government Reviewer',
    membershipRole: 'viewer',
    organizationName: 'AYUSH Regulatory Desk',
    organizationSlug: 'ayush-regulatory-desk-demo',
    description: 'Monitor review queues, source coverage and jurisdiction-aware cases.'
  },
  {
    key: 'platform_admin',
    name: 'Rohan Kapoor',
    email: 'rohan.admin@demo.ip-sakti.in',
    password: 'DemoAdmin#2026',
    accountRole: 'platform_admin',
    roleLabel: 'Platform Administrator',
    membershipRole: 'owner',
    organizationName: 'IP-SAKTI Platform Operations',
    organizationSlug: 'ipsk-platform-operations-demo',
    description: 'Manage corpus health, evaluation runs and platform operations.'
  }
];

export const demoAccountFor = key => DEMO_ACCOUNTS.find(account => account.key === key);
