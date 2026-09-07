import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../src/db/mongoose.js';
import { User, Organization, OrganizationMember, Subscription } from '../src/models/index.js';
import { CaseWorkspace } from '../src/models/legal.js';
import { DEMO_ACCOUNTS } from '../src/config/demo-accounts.js';
import { randomId } from '../src/utils/security.js';

const sampleCases = {
  applicant: [
    {
      title: 'Neem & Turmeric tablet', productName: 'Neem-Turmeric tablet', status: 'assessed',
      classification: { primary: 'PROPRIETARY_ASU_MEDICINE', confidence: 'MEDIUM', rationale: 'A new extraction process is described for a commercial Ayurvedic tablet.' },
      assessment: { confidence: 'MEDIUM', regimes: ['AYUSH', 'PATENT', 'TRADITIONAL_KNOWLEDGE', 'BIODIVERSITY_ABS'], review: true }
    }
  ],
  professional: [
    {
      title: 'Ashwagandha sleep formulation', productName: 'Ashwagandha sleep formulation', status: 'escalated',
      classification: { primary: 'PROPRIETARY_ASU_MEDICINE', confidence: 'LOW', rationale: 'Claims and classical-source evidence need professional review.' },
      assessment: { confidence: 'LOW', regimes: ['AYUSH', 'PATENT', 'LABELLING_CLAIMS'], review: true }
    },
    {
      title: 'Export herbal topical', productName: 'Export herbal topical', status: 'assessed',
      jurisdictionMode: 'INTL',
      classification: { primary: 'COSMETIC', confidence: 'MEDIUM', rationale: 'Topical use and export intent suggest a cosmetic route pending market-specific review.' },
      assessment: { confidence: 'MEDIUM', regimes: ['TRIPS', 'WIPO_GRATK', 'MADRID', 'EXPORT_MARKET_ACCESS'], review: true, jurisdictionMode: 'INTL' }
    }
  ],
  government: [
    {
      title: 'Classical churna source review', productName: 'Classical churna source review', status: 'classified',
      classification: { primary: 'CLASSICAL_ASU_MEDICINE', confidence: 'HIGH', rationale: 'The formulation is linked to an authoritative Ayurvedic text.' },
      assessment: { confidence: 'HIGH', regimes: ['AYUSH', 'TRADITIONAL_KNOWLEDGE'], review: false }
    },
    {
      title: 'Biological resource compliance review', productName: 'Biological resource compliance review', status: 'escalated',
      classification: { primary: 'RAW_BIORESOURCE_TRADE', confidence: 'LOW', rationale: 'Source, commercial intent and benefit-sharing facts remain incomplete.' },
      assessment: { confidence: 'ESCALATE', regimes: ['BIODIVERSITY_ABS', 'TRADITIONAL_KNOWLEDGE'], review: true }
    },
    {
      title: 'International treaty route sample', productName: 'International treaty route sample', status: 'assessed',
      jurisdictionMode: 'INTL',
      classification: { primary: 'NEW_ASU_CANDIDATE_REVIEW', confidence: 'MEDIUM', rationale: 'A novel process may require route-specific filing and export review.' },
      assessment: { confidence: 'MEDIUM', regimes: ['TRIPS', 'CBD_NAGOYA', 'WIPO_GRATK', 'PCT'], review: true, jurisdictionMode: 'INTL' }
    }
  ]
};

function assessmentFor(item) {
  const international = item.jurisdictionMode === 'INTL' || item.assessment.jurisdictionMode === 'INTL';
  return {
    jurisdictionMode: international ? 'INTL' : 'IN',
    jurisdictionLabel: international ? 'International' : 'India',
    jurisdictionNote: international ? 'Demo data uses the international answer set.' : 'Demo data uses the India answer set.',
    classification: item.classification,
    regimes: item.assessment.regimes.map(regime => ({
      regime,
      relevance: 'REVIEW_RECOMMENDED',
      why: 'Demo review item for the selected role workspace.',
      whatToDo: ['Review verified evidence and record the next professional action.'],
      confidence: item.assessment.confidence,
      humanReview: item.assessment.review,
      evidenceRefs: []
    })),
    actions: [{ title: 'Review source-backed next actions', detail: 'Demo action: open the case and verify its evidence before acting.', regime: item.assessment.regimes[0], priority: 'MEDIUM', requiresProfessional: item.assessment.review }],
    confidence: item.assessment.confidence,
    humanReview: { required: item.assessment.review, reason: item.assessment.review ? 'Demo case is waiting for role-specific review.' : '', unresolvedQuestions: [], recommendedProfessional: item.assessment.review ? 'Qualified IP and regulatory professional' : '' },
    evidence: []
  };
}

async function seedCase(account, organization, item) {
  const existing = await CaseWorkspace.findOne({ organizationId: organization._id, title: item.title });
  if (existing) return existing;
  const description = `Demo ${item.productName} record for the ${account.roleLabel} workspace.`;
  return CaseWorkspace.create({
    organizationId: organization._id,
    createdBy: account.userId,
    publicId: randomId('case_'),
    title: item.title,
    productName: item.productName,
    productDescription: description,
    jurisdictionMode: item.jurisdictionMode || 'IN',
    status: item.status,
    facts: { intendedUse: 'wellness_general', claims: ['Demo review record'], ingredients: [{ name: 'Ashwagandha', biologicalResource: true, classicalIngredient: true }] },
    classification: item.classification,
    latestAssessment: assessmentFor(item),
    assessments: [assessmentFor(item)]
  });
}

await connectDatabase();
const created = [];
try {
  for (const account of DEMO_ACCOUNTS) {
    const user = await User.findOneAndUpdate(
      { email: account.email },
      { $set: { name: account.name, accountRole: account.accountRole, status: 'active', emailVerifiedAt: new Date(), passwordHash: await bcrypt.hash(account.password, 12) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const organization = await Organization.findOneAndUpdate(
      { slug: account.organizationSlug },
      { $setOnInsert: { name: account.organizationName, slug: account.organizationSlug, createdBy: user._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await OrganizationMember.findOneAndUpdate(
      { organizationId: organization._id, userId: user._id },
      { $set: { role: account.membershipRole, status: 'active' }, $unset: { invitedEmail: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await Subscription.updateOne({ organizationId: organization._id }, { $setOnInsert: { plan: 'starter', status: 'trialing' } }, { upsert: true });
    account.userId = user._id;
    for (const item of sampleCases[account.key] || []) await seedCase(account, organization, item);
    created.push({ key: account.key, email: account.email, accountRole: account.accountRole, organization: account.organizationName, organizationId: organization._id.toString() });
  }
  console.log(JSON.stringify({ ok: true, accounts: created }, null, 2));
} finally {
  await disconnectDatabase();
}
