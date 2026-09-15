import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { SahayakPage, LegalSourcesPage, EvaluationPage, DevPanelPage, ActionPlan, ClassificationCard, NarrativeCard, RiskList, HumanReviewCard, AssistantPanel, ProductProfileCard, DecisionSnapshot, InternationalMarketPlanner, ComplianceDashboard, EvidencePanel } from './sahayak.jsx';
import { DashboardHome, NewCasePage, ClassificationPage, IpAssessmentPage, RegulatoryAssessmentPage, EvidencePage, ActivityPage } from './modules.jsx';
import { GuidedTour, HelpCenter } from './tour.jsx';
import { InlineHelp } from './inline-help.jsx';
import { PresenterOverlay, PRESENTER_SCENES } from './presenter.jsx';
import { KnowledgeGraph } from './knowledge-graph.jsx';
import { RecoveryHint, InlineLlmBanner, EmptyRecovery } from './recovery.jsx';

const fakeApi = { request: async () => [], accessToken: 'x' };
const fakeOrg = { _id: 'org1', name: 'Test' };

function renders(name, element) {
  it(`${name} renders without crashing`, () => {
    const html = renderToString(element);
    expect(html.length).toBeGreaterThan(10);
  });
}

describe('frontend screens mount cleanly', () => {
  renders('DashboardHome', <DashboardHome api={fakeApi} org={fakeOrg} onOpenCase={() => {}} onNewCase={() => {}}/>);
  renders('NewCasePage', <NewCasePage api={fakeApi} org={fakeOrg} onOpenCase={() => {}}/>);
  renders('MyCases(SahayakPage)', <SahayakPage api={fakeApi} org={fakeOrg} onOpenCase={() => {}}/>);
  renders('ClassificationPage', <ClassificationPage api={fakeApi} org={fakeOrg}/>);
  renders('IpAssessmentPage', <IpAssessmentPage api={fakeApi} org={fakeOrg}/>);
  renders('RegulatoryAssessmentPage', <RegulatoryAssessmentPage api={fakeApi} org={fakeOrg}/>);
  renders('EvidencePage', <EvidencePage api={fakeApi} org={fakeOrg}/>);
  renders('ActivityPage', <ActivityPage api={fakeApi} org={fakeOrg}/>);
  renders('LegalSourcesPage', <LegalSourcesPage api={fakeApi}/>);
  renders('EvaluationPage', <EvaluationPage api={fakeApi} org={fakeOrg}/>);
  renders('DevPanelPage', <DevPanelPage api={fakeApi}/>);
  renders('GuidedTour', <GuidedTour page="Dashboard" onNavigate={() => {}} onFinish={() => {}}/>);
  renders('HelpCenter', <HelpCenter onClose={() => {}} onReplayTour={() => {}}/>);
  renders('InlineHelp', <InlineHelp id="x" title="Why" body="Because" defaultOpen/>);
  renders('PresenterOverlay', <PresenterOverlay sceneIndex={0} scene={PRESENTER_SCENES[0]} total={PRESENTER_SCENES.length} onNext={()=>{}} onBack={()=>{}} onJump={()=>{}} onClose={()=>{}} paused={false} onTogglePause={()=>{}} onLoadDemo={()=>{}}/>);
  renders('KnowledgeGraph empty', <KnowledgeGraph kase={{}}/>);
  renders('KnowledgeGraph populated', <KnowledgeGraph kase={{ _id: 'a', productName: 'Neem Tablet', facts: { ingredients: [{ name: 'neem' }] }, latestAssessment: { classification: { primary: 'PROPRIETARY_ASU_MEDICINE' }, regimes: [{ regime: 'AYUSH', relevance: 'APPLICABLE' }], evidence: [{ verified: true, sourceTitle: 'Patents Act 1970' }] } }}/>);
  renders('RecoveryHint retryable', <RecoveryHint error={{ code: 'INTERNAL_ERROR', userMessage: 'oops', retryable: true, requestId: 'req_abc' }} onRetry={()=>{}} onLoadDemo={()=>{}}/>);
  renders('RecoveryHint plain Error', <RecoveryHint error={new Error('network down')} onRetry={()=>{}}/>);
  it('RecoveryHint renders null when error is null', () => {
    expect(renderToString(<RecoveryHint error={null}/>)).toBe('');
  });
  it('InlineLlmBanner renders null when online', () => {
    expect(renderToString(<InlineLlmBanner phase="online" info={{}}/>)).toBe('');
  });
  renders('InlineLlmBanner offline', <InlineLlmBanner phase="offline" info={{}}/>);
  renders('InlineLlmBanner warn', <InlineLlmBanner phase="warn" info={{ reason: 'no model loaded' }}/>);
  renders('EmptyRecovery', <EmptyRecovery title="Nothing here" description="Create a case" primary="New case" onPrimary={()=>{}} secondary="Take tour" onSecondary={()=>{}}/>);
  renders('DecisionSnapshot', <DecisionSnapshot assessment={{ confidence: 'MEDIUM', classification: { primary: 'PROPRIETARY_ASU_MEDICINE', labelLocalized: 'Proprietary ASU medicine', factsUsed: ['claims'], missingInformation: ['newProcess'] }, narrative: { assessment: 'Appears to be a proprietary medicine candidate.', meaning: 'Review the evidence.' }, actions: [{ title: 'Confirm the route', priority: 'HIGH', why: 'It matters.' }], unknowns: ['Confirm the process'] }} onGenerateSummary={()=>{}} onCopySummary={()=>{}}/>);
  renders('InternationalMarketPlanner', <InternationalMarketPlanner facts={{ targetMarkets: ['EU'] }} onSave={()=>{}}/>);

  it('assessed-case sections render (action why, assistant, profile)', () => {
    const assessment = {
      narrative: { assessment: 'A', meaning: 'B' }, confidence: 'MEDIUM',
      classification: { primary: 'PROPRIETARY_ASU_MEDICINE', confidence: 'MEDIUM', rationale: 'One. Two.' },
      regimes: [{ regime: 'AYUSH', relevance: 'APPLICABLE', why: 'w', label: 'x', whatToDo: ['do'], humanReview: false }],
      actions: [{ title: 'act', why: 'because', regime: 'AYUSH', priority: 'HIGH' }],
      risks: [{ description: 'r', severity: 'YELLOW' }], unknowns: ['u'], assumptions: ['a'],
      evidence: [{ claim: 'c', sourceKey: 'k', sourceTitle: 'T', supportLevel: 'DIRECTLY_SUPPORTED', verified: true }],
      humanReview: { required: true, reason: 'why', recommendedProfessional: 'pro' }
    };
    const kase = { _id: 'c1', publicId: 'case_x', title: 'T', status: 'assessed', language: 'en', facts: {}, questions: [], assistantMessages: [] };
    const out = [
      renderToString(<ActionPlan actions={assessment.actions}/>),
      renderToString(<ClassificationCard data={assessment.classification}/>),
      renderToString(<NarrativeCard narrative={assessment.narrative} confidence={assessment.confidence}/>),
      renderToString(<RiskList risks={assessment.risks}/>),
      renderToString(<HumanReviewCard review={assessment.humanReview}/>),
      renderToString(<ProductProfileCard facts={{ ingredients: [{ name: 'neem' }] }}/>),
      renderToString(<AssistantPanel api={fakeApi} org={fakeOrg} kase={kase}/>)
    ].join('');
    expect(out).toContain('act');
    expect(out).toContain('chev'); // expandable "why" affordance present
    expect(out).toContain('IP-SAKTI Assistant');
    expect(out).toContain('neem');
  });

  it('uses international labels and citations in the case workspace', () => {
    const assessment = { jurisdictionMode: 'INTL', regimes: [], evidence: [{ claim: 'International claim', sourceKey: 'pct_system', sourceTitle: 'PCT', jurisdiction: 'INTL', verified: true, supportLevel: 'DIRECTLY_SUPPORTED' }] };
    const html = renderToString(<><ComplianceDashboard assessment={assessment}/><EvidencePanel evidence={assessment.evidence}/></>);
    expect(html).toContain('Potentially relevant international routes');
    expect(html).toContain('International reference corpus');
    expect(html).not.toContain('Applicable Indian regimes');
  });

  it('InlineHelp and HelpCenter render their content', () => {
    const inline = renderToString(<InlineHelp id="x" title="Why?" body="Because." defaultOpen/>);
    expect(inline).toContain('How this works');
    expect(inline).toContain('Why?');
    expect(inline).toContain('Because.');
    const help = renderToString(<HelpCenter onClose={() => {}} onReplayTour={() => {}}/>);
    expect(help).toContain('How IP-SAKTI works');
    expect(help).toContain('Does this replace a lawyer?');
    const tour = renderToString(<GuidedTour page="Dashboard" onNavigate={() => {}} onFinish={() => {}}/>);
    expect(tour).toContain('Welcome to IP-SAKTI Sahayak');
    expect(tour).toContain('STEP');
    expect(tour).toContain('OF');
    expect(tour).toContain('Skip tour');
  });
});
