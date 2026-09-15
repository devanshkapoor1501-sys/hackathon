import PDFDocument from 'pdfkit';

const BRAND = {
  name: 'IP-SAKTI Sahayak',
  tagline: 'Decision support for Ayurvedic IP and regulatory pathways',
  ps: 'SIH 26045'
};
const COLORS = {
  deep: '#0e3b2e', green: '#14532f', leaf: '#1f7a4d', mint: '#e8f5ee',
  ink: '#17211c', muted: '#5e7065', line: '#dbe6df', paper: '#f7faf8',
  gold: '#d97706', goldBg: '#fff8e0', red: '#b02a2a', redBg: '#fff1ef', grey: '#69756e'
};
const left = 48;
const right = 48;
const top = 88;
const bottom = 62;

const textValue = value => String(value == null || value === '' ? '-' : value);
const readable = value => textValue(value).replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function renderCaseReportPDF({ kase, assessment }) {
  const doc = new PDFDocument({ size: 'A4', margins: { top, bottom, left, right }, bufferPages: true });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  const done = new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));
  const width = doc.page.width - left - right;
  const generated = new Date().toISOString().slice(0, 10);
  const assessmentDate = textValue(assessment.asOfDate || assessment.createdAt || generated).slice(0, 10);
  const facts = kase.facts?.toObject?.() || kase.facts || {};
  const language = kase.language || assessment.language || 'en';
  const jurisdiction = assessment.jurisdictionMode === 'INTL' ? 'International' : 'India';
  const versionCount = (kase.assessments || []).length || 1;

  function drawHeader() {
    const cursor = { x: doc.x, y: doc.y };
    doc.save();
    doc.rect(0, 0, doc.page.width, 64).fill(COLORS.deep);
    doc.fillColor('#e8f5ee').circle(46, 32, 14).fill();
    doc.fillColor(COLORS.gold).circle(46, 32, 4.5).fill();
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(15).text(BRAND.name, 70, 21);
    doc.fillColor('#cfe7da').font('Helvetica').fontSize(8).text(BRAND.tagline, 70, 40);
    doc.fillColor('#9de8c5').font('Helvetica-Bold').fontSize(9).text(BRAND.ps, doc.page.width - 105, 21, { width: 57, align: 'right' });
    doc.fillColor('#cfe7da').font('Helvetica').fontSize(8).text(`v${versionCount} - ${generated}`, doc.page.width - 105, 40, { width: 57, align: 'right' });
    doc.restore();
    doc.x = cursor.x;
    doc.y = cursor.y;
  }

  let drawingFooter = false;
  function drawFooter() {
    if (drawingFooter) return;
    drawingFooter = true;
    const cursor = { x: doc.x, y: doc.y };
    try {
      const y = doc.page.height - bottom - 10;
      doc.moveTo(left, y - 8).lineTo(doc.page.width - right, y - 8).lineWidth(.5).strokeColor(COLORS.line).stroke();
      doc.font('Helvetica').fontSize(7.1).fillColor(COLORS.grey)
        .text(`${BRAND.name} - assessment date ${assessmentDate} - decision support only - not legal advice or government approval`, left, y, { width: width - 70, lineBreak: false, ellipsis: true });
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.green)
        .text(`Page ${doc.bufferedPageRange().count}`, doc.page.width - right - 52, y, { width: 52, align: 'right', lineBreak: false });
      doc.x = cursor.x;
      doc.y = cursor.y;
    } finally { drawingFooter = false; }
  }
  doc.on('pageAdded', () => { drawHeader(); drawFooter(); });
  drawHeader();
  drawFooter();

  function ensureSpace(height = 48) {
    if (doc.y + height > doc.page.height - bottom) doc.addPage();
  }
  function heading(title, kicker = '') {
    doc.x = left;
    ensureSpace(45);
    if (kicker) doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.leaf).text(kicker.toUpperCase(), { width });
    doc.moveDown(kicker ? .12 : .4);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.green).text(title, { width });
    doc.moveDown(.26);
  }
  function paragraph(value, options = {}) {
    doc.x = left;
    const content = textValue(value);
    ensureSpace(options.minHeight || 22);
    doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(options.size || 9.2).fillColor(options.color || '#222')
      .text(content, { width: options.width || width, lineGap: options.lineGap ?? 2, indent: options.indent || 0, continued: false });
    return doc.y;
  }
  function bullet(value, options = {}) {
    return paragraph(`- ${value}`, { ...options, indent: options.indent || 8, size: options.size || 9 });
  }
  function callout(title, body, tone = 'mint') {
    doc.x = left;
    const bg = tone === 'gold' ? COLORS.goldBg : tone === 'red' ? COLORS.redBg : COLORS.mint;
    const border = tone === 'gold' ? COLORS.gold : tone === 'red' ? COLORS.red : '#b8dfc8';
    const bodyText = textValue(body);
    const bodyHeight = doc.heightOfString(bodyText, { width: width - 26, font: 'Helvetica', fontSize: 9.2, lineGap: 2 });
    const h = 27 + bodyHeight;
    ensureSpace(h + 8);
    const y = doc.y;
    doc.roundedRect(left, y, width, h + 10, 7).fillAndStroke(bg, border);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(tone === 'gold' ? '#6b5312' : tone === 'red' ? COLORS.red : COLORS.deep).text(title, left + 12, y + 8, { width: width - 24 });
    doc.font('Helvetica').fontSize(9.2).fillColor('#30453a').text(bodyText, left + 12, y + 24, { width: width - 24, lineGap: 2 });
    doc.y = y + h + 10;
  }
  function keyValue(label, value) {
    doc.x = left;
    ensureSpace(20);
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.muted).text(label, left, y, { width: 130 });
    doc.font('Helvetica').fontSize(9).fillColor('#222').text(textValue(value), left + 136, y, { width: width - 136, lineGap: 2 });
    doc.y = Math.max(doc.y, y + 14);
  }
  function table(headers, rows, widths) {
    const tableWidth = widths.reduce((a, b) => a + b, 0);
    const startX = left;
    ensureSpace(34);
    let y = doc.y;
    const headerHeight = 22;
    const drawTableHeader = () => {
      doc.rect(startX, y, tableWidth, headerHeight).fill(COLORS.deep);
      let x = startX;
      headers.forEach((header, i) => { doc.font('Helvetica-Bold').fontSize(7.7).fillColor('#fff').text(header, x + 6, y + 7, { width: widths[i] - 12, lineBreak: false }); x += widths[i]; });
      y += headerHeight;
    };
    drawTableHeader();
    rows.forEach((row, rowIndex) => {
      const cells = row.map((cell, i) => textValue(cell));
      const heights = cells.map((cell, i) => doc.heightOfString(cell, { width: widths[i] - 12, font: 'Helvetica', fontSize: 7.7, lineGap: 1.5 }));
      const rowHeight = Math.max(24, ...heights) + 10;
      if (y + rowHeight > doc.page.height - bottom) { doc.addPage(); y = doc.y; drawTableHeader(); }
      doc.rect(startX, y, tableWidth, rowHeight).fillAndStroke(rowIndex % 2 ? '#fff' : COLORS.paper, COLORS.line);
      let x = startX;
      cells.forEach((cell, i) => { doc.font('Helvetica').fontSize(7.7).fillColor('#26362d').text(cell, x + 6, y + 6, { width: widths[i] - 12, lineGap: 1.5 }); x += widths[i]; });
      y += rowHeight;
    });
    doc.y = y + 8;
    doc.x = left;
  }

  const classification = assessment.classification || {};
  const classificationLabel = classification.labelLocalized || readable(classification.primary);
  const activeRegimes = (assessment.regimes || []).filter(r => ['APPLICABLE', 'POSSIBLY_APPLICABLE', 'REVIEW_RECOMMENDED'].includes(r.relevance));
  const selectedMarkets = (facts.targetMarkets || []).map(m => m === 'OTHER' ? (facts.targetMarketOther || 'Custom country') : ({ EU: 'European Union', US: 'United States', UAE: 'United Arab Emirates' }[m] || m));

  // Branded cover page.
  doc.moveDown(1.2);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.leaf).text('IP-SAKTI SAHAYAK - DECISION SUPPORT');
  doc.moveDown(.3);
  doc.font('Helvetica-Bold').fontSize(28).fillColor(COLORS.deep).text('Decision Brief');
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.muted).text('Assessment + evidence appendix');
  doc.moveDown(1.1);
  doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.ink).text(kase.productName || kase.title, { width });
  doc.moveDown(.25);
  paragraph(`${jurisdiction} answer set - ${language === 'hi' ? 'Hindi' : 'English'} - case ${kase.publicId}`, { size: 9, color: COLORS.muted });
  doc.moveDown(.9);
  table(['Case', 'Assessment', 'Decision lens'], [[kase.publicId, assessmentDate, jurisdiction]], [width * .35, width * .25, width * .4]);
  callout('How to use this brief', 'This report explains what the recorded facts suggest, why the decision-support engine reached that result, what remains uncertain and what to verify next. It is not a legal opinion, regulatory approval or patentability decision.', 'gold');
  heading('Executive decision', 'At a glance');
  keyValue('Product appears to be', classificationLabel);
  keyValue('Confidence', `${readable(assessment.confidence)} - ${assessment.confidence === 'HIGH' ? 'strong alignment across recorded facts and evidence' : assessment.confidence === 'MEDIUM' ? 'useful for planning, with confirmation still needed' : 'important facts or evidence remain limited'}`);
  keyValue('Human review', assessment.humanReview?.required ? 'Recommended before relying on this result' : 'Not required by the current escalation rules, but professional verification remains prudent');
  paragraph(assessment.narrative?.assessment || classification.rationale, { size: 10, bold: true, color: COLORS.deep });
  doc.addPage();

  // What the user told us.
  heading('What you told us', '01 - recorded case facts');
  keyValue('Product description', kase.productDescription);
  keyValue('Ingredients', (facts.ingredients || []).map(i => i.name).join(', '));
  keyValue('Claims', (facts.claims || []).join('; '));
  keyValue('Intended use', readable(facts.intendedUse));
  keyValue('Dosage form / route', `${readable(facts.dosageForm)} / ${readable(facts.routeOfAdministration)}`);
  keyValue('Classical basis', readable(facts.classicalSource));
  keyValue('Commercial intent', readable(facts.commercialIntent));
  keyValue('Target markets', selectedMarkets.length ? selectedMarkets.join(', ') : 'Not selected');
  if (facts.processDescription) keyValue('Process detail', facts.processDescription);

  heading('What this means', '02 - conclusion and boundaries');
  paragraph(assessment.narrative?.meaning || 'The current evidence and rule screens should be reviewed together with the decision snapshot in the workspace.');
  if (activeRegimes.length) {
    table(['Area to check', 'Current signal', 'Why it appears', 'First verification step'], activeRegimes.slice(0, 10).map(r => [r.label || readable(r.regime), readable(r.relevance), r.why || '-', (r.whatToDo || [])[0] || '-']), [125, 70, 175, width - 370]);
  } else paragraph('No major regime is currently indicated from the stored facts.', { color: COLORS.muted });
  if (assessment.jurisdictionMode === 'INTL') callout('International boundary', 'Treaty systems and route pointers do not replace the law of the target country. Classification, claims, labelling, safety, importer and local licensing checks remain country-specific.', 'gold');
  else callout('India boundary', 'This assessment uses the India corpus only. It does not establish approval, licence status or patentability for this formulation.', 'gold');

  heading('Priority next steps', '03 - start here');
  const actions = [...(assessment.actions || [])].sort((a, b) => (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2));
  if (actions.length) table(['Priority', 'Action', 'Why it matters', 'Professional help'], actions.slice(0, 12).map(a => [readable(a.priority), a.title, a.why || '-', a.requiresProfessional ? 'Recommended' : 'Not flagged']), [58, 170, 195, width - 423]);
  else paragraph('No action items were generated. Re-run the assessment after recording more product facts.', { color: COLORS.muted });

  heading('Risks and unresolved information', '04 - what could change the result');
  for (const risk of assessment.risks || []) bullet(`[${readable(risk.severity)}] ${risk.description}`);
  for (const unknown of assessment.unknowns || []) bullet(unknown);
  if (assessment.humanReview?.reason) callout('Before relying on this', `${assessment.humanReview.reason} Recommended professional: ${assessment.humanReview.recommendedProfessional || 'qualified regulatory or IP professional'}.`, 'red');

  if (assessment.jurisdictionMode === 'INTL' || selectedMarkets.length) {
    heading('International target-market plan', '05 - checklists, not approvals');
    keyValue('Selected markets', selectedMarkets.length ? selectedMarkets.join(', ') : 'None - select markets in the workspace');
    paragraph('Each route below is a planning checklist. Treaty-level pointers do not replace target-country law.');
    const routes = (assessment.marketRoutes || []).filter(r => r.id !== 'WIPO');
    if (routes.length) table(['Market / route', 'Status', 'Authority', 'Checklist'], routes.map(r => [r.name, readable(r.status), r.authority, (r.steps || []).join(' - ')]), [118, 88, 125, width - 331]);
    if (selectedMarkets.includes('Custom country')) callout('Custom country', 'No country-specific law has been inferred. Identify the regulator and verify classification, claims, ingredients, quality, safety, labelling, import and local licensing requirements directly.', 'gold');
  }

  if (assessment.userSummary) {
    heading('Plain-language summary', '06 - generated on request');
    paragraph(assessment.userSummary.overview, { bold: true, color: COLORS.deep });
    for (const point of assessment.userSummary.keyPoints || []) bullet(point);
    if (assessment.userSummary.nextSteps?.length) { paragraph('Next steps', { bold: true, color: COLORS.green }); for (const step of assessment.userSummary.nextSteps) bullet(step); }
    paragraph(assessment.userSummary.caveat, { size: 8.5, color: COLORS.muted });
  }

  heading('Evidence appendix', '07 - source traceability');
  paragraph('Each row records the claim used, its authority, section, status, verification result and official URL. Verification is jurisdiction-scoped; an International source is not used as an India conclusion.', { color: COLORS.muted });
  const evidence = assessment.evidence || [];
  if (!evidence.length) paragraph('No evidence claims were stored for this assessment.', { color: COLORS.muted });
  else evidence.forEach((ev, index) => {
    const support = ev.untrustedDocumentFlagged ? 'Untrusted text quarantined' : `${readable(ev.supportLevel)}${ev.verified ? ' - verified' : ' - not verified'}`;
    table(['Claim', 'Authority / section', 'Status', 'Verification / official URL'], [[`E${index + 1} - ${ev.claim}`, `${ev.authority || '-'}${ev.section ? ` - ${ev.section}` : ''}`, `${ev.status || '-'}${ev.effectiveFrom ? ` from ${ev.effectiveFrom}` : ''}`, `${support}\n${ev.url || 'No URL stored'}`]], [170, 112, 82, width - 364]);
  });

  heading('Human review handoff', '08 - controlled professional review');
  keyValue('Required', assessment.humanReview?.required ? 'Yes' : 'No by current rules');
  keyValue('Reason', assessment.humanReview?.reason);
  keyValue('Recommended professional', assessment.humanReview?.recommendedProfessional);
  if (assessment.llmUsed === false) callout('Offline / deterministic mode', 'This brief was prepared without an available AI provider. The deterministic assessment path was used and no AI explanation was presented as AI-generated.', 'gold');
  callout('Final limitation', 'Review the current official source, product facts and target-country requirements before filing, manufacturing, advertising, importing or selling. Obtain professional advice for decisions that affect rights, licences or market access.', 'gold');

  doc.end();
  return done;
}
