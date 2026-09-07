import PDFDocument from 'pdfkit';

const BRAND = { name: 'IP-SAKTI Sahayak', tagline: 'AI-powered IP & regulatory decision support for Ayurveda · India', ps: 'SIH 26045' };

export function renderCaseReportPDF({ kase, assessment }) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 88, bottom: 64, left: 52, right: 52 } });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  const done = new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const width = doc.page.width - 104;
  const generated = new Date();
  const generatedStr = generated.toISOString().slice(0, 10);
  const versionCount = (kase.assessments || []).length || 1;

  // ===== Header on every page =====
  const drawHeader = () => {
    const y = 30;
    // Brand bar background
    doc.rect(0, 0, doc.page.width, 64).fill('#0e3b2e');
    // Leaf mark (simple geometric)
    doc.save();
    doc.fillColor('#e8f5ee').circle(48, 32, 14).fill();
    doc.fillColor('#d97706').circle(48, 32, 4.5).fill();
    doc.restore();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15).text(BRAND.name, 72, 22);
    doc.font('Helvetica').fontSize(8).fillColor('#cfe7da').text(BRAND.tagline, 72, 40);
    doc.fillColor('#d97706').font('Helvetica-Bold').fontSize(9).text(BRAND.ps, doc.page.width - 90, 22, { width: 70, align: 'right' });
    doc.fillColor('#cfe7da').font('Helvetica').fontSize(8).text(`v${versionCount} · ${generatedStr}`, doc.page.width - 90, 40, { width: 70, align: 'right' });
  };

  // ===== Footer on every page =====
  let drawingFooter = false;
  const drawFooter = () => {
    if (drawingFooter) return;
    drawingFooter = true;
    try {
      const y = doc.page.height - 30;
      const footerText = `${BRAND.name} · ${BRAND.ps} · decision support — not legal advice — not a government approval`;
      doc.font('Helvetica').fontSize(7.5).fillColor('#888');
      doc.text(footerText, 52, y, { width: doc.page.width - 200, lineBreak: false, ellipsis: true });
      doc.fillColor('#14532f').font('Helvetica-Bold').fontSize(8)
        .text(`Page ${doc.bufferedPageRange().count}`, doc.page.width - 110, y, { width: 58, align: 'right', lineBreak: false });
    } finally { drawingFooter = false; }
  };

  doc.on('pageAdded', () => { drawHeader(); drawFooter(); });
  drawHeader();
  drawFooter();

  // ===== Cover summary =====
  // Big classification
  const cls = assessment.classification;
  const clsLabel = cls?.labelLocalized || cls?.primary || '—';
  const confidence = assessment.confidence || '—';
  doc.moveDown(1.5);
  doc.font('Helvetica').fontSize(9).fillColor('#6b7a70').text('PRODUCT');
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#14532f').text(kase.productName || kase.title, { width });
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(8).fillColor('#888').text(`Case ${kase.publicId} · generated ${generatedStr} · ${kase.demoScenario ? 'DEMO CASE (simulated data)' : 'real case'} · India-only corpus`);

  // Cover "scorecard" — three boxes
  const boxY = doc.y + 12;
  const boxH = 56;
  const boxW = (width - 16) / 3;
  const drawBox = (x, label, value, sub) => {
    doc.rect(x, boxY, boxW, boxH).lineWidth(0.6).strokeColor('#dde5df').fillAndStroke();
    doc.font('Helvetica').fontSize(7.5).fillColor('#6b7a70').text(label.toUpperCase(), x + 10, boxY + 10);
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#14532f').text(value, x + 10, boxY + 22, { width: boxW - 20 });
    doc.font('Helvetica').fontSize(8).fillColor('#45524a').text(sub || '', x + 10, boxY + 42, { width: boxW - 20 });
  };
  drawBox(52, 'Classification', String(clsLabel).replaceAll('_', ' ').toUpperCase(), `Confidence: ${confidence}`);
  drawBox(52 + boxW + 8, 'Risk level', confidence, `${(assessment.risks || []).length} flagged item(s)`);
  drawBox(52 + (boxW + 8) * 2, 'Regimes flagged', `${(assessment.regimes || []).filter(r => r.relevance === 'APPLICABLE' || r.relevance === 'POSSIBLY_APPLICABLE').length} potentially applicable`, `Human review: ${assessment.humanReview?.required ? 'REQUIRED' : 'optional'}`);
  doc.y = boxY + boxH + 12;

  // Disclaimer banner
  doc.rect(52, doc.y, width, 22).fillAndStroke('#fff8e0', '#ecd28a');
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#6b5312').text(
    'Decision-support output. NOT legal advice, NOT a government approval, NOT a patentability opinion. Verify with qualified professionals before acting.',
    58, doc.y + 5, { width: width - 12 }
  );
  doc.y += 30;

  const heading = text => { doc.moveDown(0.5).font('Helvetica-Bold').fontSize(11.5).fillColor('#14532f').text(text.toUpperCase()); doc.moveDown(0.25); };
  const body = (text, options = {}) => doc.font('Helvetica').fontSize(9).fillColor('#222').text(String(text ?? '—'), { width, ...options });

  // Case facts summary
  heading('Case information');
  body(`Status: ${kase.status}   Language: ${kase.language || 'en'}   Product: ${kase.productName || kase.title}`);
  body(kase.productDescription?.slice(0, 900) || '');

  // Classification
  heading('Product classification');
  if (assessment.classification) {
    body(`Primary: ${assessment.classification.labelLocalized || assessment.classification.primary}`);
    body(`Confidence: ${assessment.confidence}${assessment.classification.missingInformation?.length ? `   Missing critical facts: ${assessment.classification.missingInformation.join(', ')}` : ''}`);
    body(assessment.narrative?.assessment || '');
    doc.moveDown(0.15); body(assessment.narrative?.meaning || '');
  }

  // Regimes
  heading('Potentially applicable Indian regimes');
  for (const regime of assessment.regimes || []) {
    body(`• ${regime.regime} — ${regime.relevance}`, { indent: 8 });
    doc.fontSize(8.5).fillColor('#444'); body(regime.why || '', { indent: 16 });
    doc.fillColor('#222');
  }

  // ABS + TK
  heading('Biodiversity / ABS screen');
  if (assessment.absScreen) {
    body(`Relevance: ${assessment.absScreen.relevance} — ${assessment.absScreen.reason}`);
    for (const obligation of assessment.absScreen.obligations || []) body(`• ${obligation}`, { indent: 12 });
    body(`Authority: ${assessment.absScreen.authority || '—'}`);
  }
  heading('Traditional knowledge / Section 3(p)');
  if (assessment.tkConsiderations) {
    body(`Level: ${assessment.tkConsiderations.level}`);
    body(assessment.tkConsiderations.why || '');
    for (const item of assessment.tkConsiderations.whatToVerify || []) body(`• Verify: ${item}`, { indent: 12 });
  }

  // Actions
  heading('Action plan');
  let index = 1;
  for (const action of assessment.actions || []) {
    body(`${index++}. [${action.priority}] ${action.title}${action.requiresProfessional ? ' (professional recommended)' : ''}`);
  }

  // Risks
  heading('Risks & uncertainties');
  for (const risk of assessment.risks || []) body(`• [${risk.severity}] ${risk.description}`);
  for (const unknown of assessment.unknowns || []) body(`? ${unknown}`);

  // Evidence
  heading('Evidence & citations');
  for (const [i, ev] of (assessment.evidence || []).entries()) {
    body(`[E${i + 1}] ${ev.claim}`);
    doc.fontSize(8.5).fillColor('#444');
    body(`${ev.sourceTitle || ev.sourceKey} — ${ev.authority || ''} ${ev.section ? `· ${ev.section}` : ''} · status=${ev.status || '?'}${ev.effectiveFrom ? ` · effective ${ev.effectiveFrom}` : ''} → ${ev.supportLevel}${ev.untrustedDocumentFlagged ? ' · ⚠ UNTRUSTED DOCUMENT' : ''}`, { indent: 14 });
    doc.fillColor('#222').fontSize(9);
  }

  // Confidence + human review
  heading('Confidence & human review');
  body(`Derived confidence: ${assessment.confidence}`);
  if (assessment.humanReview) {
    body(`Human review required: ${assessment.humanReview.required ? 'YES' : 'no'}`);
    body(`Reason: ${assessment.humanReview.reason}`);
    body(`Recommended professionals: ${assessment.humanReview.recommendedProfessional || '—'}`);
    if (assessment.humanReview.unresolvedQuestions?.length) body(`Unresolved: ${assessment.humanReview.unresolvedQuestions.join('; ')}`);
  }
  if (assessment.llmUsed === false) {
    doc.moveDown(0.2);
    doc.fontSize(8.5).fillColor('#a33').text('Note: generated without LLM (offline/deterministic mode) — no content was fabricated.');
  }

  doc.end();
  return done;
}
