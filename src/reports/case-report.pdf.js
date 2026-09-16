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
const labelWidth = 128;
const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function normalizeText(value) {
  return String(value == null || value === '' ? '-' : value)
    .replace(/\r\n?/g, '\n')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/[•▪]/g, '-')
    .replace(/[→⇒]/g, '->')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

const textValue = value => normalizeText(value);
const readable = value => textValue(value).replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());

export function renderCaseReportPDF({ kase, assessment }) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top, bottom, left, right },
    bufferPages: true,
    info: {
      Title: `IP-SAKTI Decision Brief - ${kase.publicId || kase.productName || 'case'}`,
      Author: BRAND.name,
      Subject: 'Source-cited IP and regulatory decision support assessment'
    }
  });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  const done = new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const width = doc.page.width - left - right;
  const contentBottom = doc.page.height - bottom - 24;
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
    doc.fillColor('#9de8c5').font('Helvetica-Bold').fontSize(9)
      .text(BRAND.ps, doc.page.width - 105, 21, { width: 57, align: 'right' });
    doc.fillColor('#cfe7da').font('Helvetica').fontSize(8)
      .text(`v${versionCount} - ${generated}`, doc.page.width - 105, 40, { width: 57, align: 'right' });
    doc.restore();
    doc.x = cursor.x;
    doc.y = cursor.y;
  }

  function drawFooter(pageNumber, totalPages) {
    const cursor = { x: doc.x, y: doc.y };
    const y = doc.page.height - bottom - 10;
    doc.save();
    doc.moveTo(left, y - 8).lineTo(doc.page.width - right, y - 8)
      .lineWidth(.5).strokeColor(COLORS.line).stroke();
    doc.font('Helvetica').fontSize(7.1).fillColor(COLORS.grey)
      .text(`${BRAND.name} - assessment date ${assessmentDate} - decision support only - not legal advice or government approval`,
        left, y, { width: width - 70, lineBreak: false, ellipsis: true });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.green)
      .text(`Page ${pageNumber} of ${totalPages}`, doc.page.width - right - 70, y, {
        width: 70, align: 'right', lineBreak: false
      });
    doc.restore();
    doc.x = cursor.x;
    doc.y = cursor.y;
  }

  drawHeader();

  function addPage() {
    doc.addPage();
    drawHeader();
  }

  function ensureSpace(height = 32) {
    if (doc.y + height > contentBottom) addPage();
  }

  function wrapLines(value, textWidth, font = 'Helvetica', fontSize = 9.2, maxLines = Infinity) {
    const content = textValue(value);
    doc.font(font).fontSize(fontSize);
    const lines = [];
    const pushWord = word => {
      if (!word) return;
      if (doc.widthOfString(word) <= textWidth) {
        const current = lines.at(-1) || '';
        const candidate = current ? `${current} ${word}` : word;
        if (!current) lines.push(word);
        else if (doc.widthOfString(candidate) <= textWidth) lines[lines.length - 1] = candidate;
        else lines.push(word);
        return;
      }
      let piece = '';
      for (const character of word) {
        const candidate = piece + character;
        if (piece && doc.widthOfString(candidate) > textWidth) {
          lines.push(piece);
          piece = character;
        } else piece = candidate;
      }
      if (piece) {
        const current = lines.at(-1) || '';
        if (current && doc.widthOfString(`${current} ${piece}`) <= textWidth) lines[lines.length - 1] = `${current} ${piece}`;
        else lines.push(piece);
      }
    };

    for (const rawLine of content.split('\n')) {
      if (!rawLine.trim()) { lines.push(''); continue; }
      for (const word of rawLine.trim().split(/\s+/)) pushWord(word);
    }
    if (!lines.length) lines.push('-');
    if (lines.length <= maxLines) return lines;

    const clipped = lines.slice(0, Math.max(1, maxLines));
    const last = clipped.length - 1;
    let suffix = `${clipped[last].replace(/\.*$/, '')}...`;
    while (doc.widthOfString(suffix) > textWidth && suffix.length > 4) suffix = suffix.slice(0, -4) + '...';
    clipped[last] = suffix;
    return clipped;
  }

  function drawParagraph(value, options = {}) {
    const font = options.bold ? 'Helvetica-Bold' : 'Helvetica';
    const size = options.size || 9.2;
    const lineGap = options.lineGap ?? 2;
    const textWidth = options.width || width;
    const lines = wrapLines(value, textWidth, font, size);
    const lineHeight = size + lineGap;
    let offset = 0;
    doc.x = left;

    while (offset < lines.length) {
      const availableLines = Math.floor((contentBottom - doc.y) / lineHeight);
      if (availableLines < 1) { addPage(); continue; }
      const take = Math.min(availableLines, lines.length - offset);
      const chunk = lines.slice(offset, offset + take).join('\n');
      doc.font(font).fontSize(size).fillColor(options.color || '#222')
        .text(chunk, { width: textWidth, lineGap, indent: options.indent || 0, continued: false });
      offset += take;
      if (offset < lines.length) addPage();
    }
    return doc.y;
  }

  function heading(title, kicker = '') {
    const kickerText = kicker ? textValue(kicker).toUpperCase() : '';
    const titleText = textValue(title);
    const kickerHeight = kickerText ? doc.heightOfString(kickerText, { width, font: 'Helvetica-Bold', fontSize: 7.5 }) : 0;
    const titleHeight = doc.heightOfString(titleText, { width, font: 'Helvetica-Bold', fontSize: 12 });
    ensureSpace(kickerHeight + titleHeight + 24);
    doc.x = left;
    if (kickerText) doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.leaf).text(kickerText, { width });
    doc.moveDown(kickerText ? .12 : .4);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.green).text(titleText, { width });
    doc.moveDown(.26);
  }

  function bullet(value, options = {}) {
    return drawParagraph(`- ${value}`, { ...options, indent: options.indent || 8, size: options.size || 9 });
  }

  function callout(title, body, tone = 'mint') {
    const bg = tone === 'gold' ? COLORS.goldBg : tone === 'red' ? COLORS.redBg : COLORS.mint;
    const border = tone === 'gold' ? COLORS.gold : tone === 'red' ? COLORS.red : '#b8dfc8';
    const titleColor = tone === 'gold' ? '#6b5312' : tone === 'red' ? COLORS.red : COLORS.deep;
    const bodyLines = wrapLines(body, width - 24, 'Helvetica', 9.2);
    const lineHeight = 11.2;
    const maxLinesPerCard = 18;
    for (let offset = 0; offset < bodyLines.length; offset += maxLinesPerCard) {
      const lines = bodyLines.slice(offset, offset + maxLinesPerCard);
      const titleText = offset ? `${textValue(title)} (continued)` : textValue(title);
      const height = 34 + lines.length * lineHeight;
      ensureSpace(height + 8);
      const y = doc.y;
      doc.roundedRect(left, y, width, height + 8, 7).fillAndStroke(bg, border);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(titleColor)
        .text(titleText, left + 12, y + 8, { width: width - 24 });
      doc.font('Helvetica').fontSize(9.2).fillColor('#30453a')
        .text(lines.join('\n'), left + 12, y + 25, { width: width - 24, lineGap: 2 });
      doc.y = y + height + 8;
    }
  }

  function keyValue(label, value) {
    const valueWidth = width - labelWidth - 8;
    const lines = wrapLines(value, valueWidth, 'Helvetica', 9);
    const lineHeight = 11.2;
    let offset = 0;
    while (offset < lines.length) {
      ensureSpace(lineHeight + 3);
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.muted)
        .text(label ? textValue(label) : '', left, y, { width: labelWidth });
      doc.font('Helvetica').fontSize(9).fillColor('#222')
        .text(lines[offset], left + labelWidth + 8, y, { width: valueWidth, lineGap: 2 });
      doc.y = y + lineHeight;
      offset += 1;
      label = '';
    }
    doc.y += 2;
  }

  function table(headers, rows, widths, options = {}) {
    const tableWidth = widths.reduce((sum, item) => sum + item, 0);
    const startX = left;
    const fontSize = options.fontSize || 7.7;
    const lineHeight = fontSize + 1.5;
    const maxLines = options.maxLines || 8;
    const headerLines = headers.map((header, index) => wrapLines(header, widths[index] - 12, 'Helvetica-Bold', fontSize, 2));
    const headerHeight = Math.max(24, ...headerLines.map(lines => lines.length * lineHeight + 10));
    let y;

    const drawTableHeader = () => {
      doc.rect(startX, y, tableWidth, headerHeight).fill(COLORS.deep);
      let x = startX;
      headerLines.forEach((lines, index) => {
        doc.font('Helvetica-Bold').fontSize(fontSize).fillColor('#fff')
          .text(lines.join('\n'), x + 6, y + 6, { width: widths[index] - 12, lineGap: 1 });
        x += widths[index];
      });
      y += headerHeight;
    };

    ensureSpace(headerHeight + 28);
    y = doc.y;
    drawTableHeader();
    rows.forEach((row, rowIndex) => {
      const cells = row.map((cell, index) => wrapLines(cell, widths[index] - 12, 'Helvetica', fontSize, maxLines));
      const rowHeight = Math.max(24, ...cells.map(lines => lines.length * lineHeight + 10));
      if (y + rowHeight > contentBottom) {
        addPage();
        y = doc.y;
        drawTableHeader();
      }
      doc.rect(startX, y, tableWidth, rowHeight).fillAndStroke(rowIndex % 2 ? '#fff' : COLORS.paper, COLORS.line);
      let x = startX;
      cells.forEach((lines, index) => {
        doc.font('Helvetica').fontSize(fontSize).fillColor('#26362d')
          .text(lines.join('\n'), x + 6, y + 6, { width: widths[index] - 12, lineGap: 1.5 });
        x += widths[index];
      });
      y += rowHeight;
    });
    doc.y = y + 8;
    doc.x = left;
  }

  function evidenceCard(ev, index) {
    const support = ev.untrustedDocumentFlagged
      ? 'Untrusted text quarantined'
      : `${readable(ev.supportLevel)}${ev.verified ? ' - verified' : ' - not verified'}`;
    const fields = [
      [`E${index + 1} - Claim`, ev.claim],
      ['Authority / section', `${ev.authority || '-'}${ev.section ? ` - ${ev.section}` : ''}`],
      ['Status', `${ev.status || '-'}${ev.effectiveFrom ? ` from ${ev.effectiveFrom}` : ''}`],
      ['Verification', support],
      ['Official URL', ev.url || 'No URL stored']
    ];
    const valueWidth = width - labelWidth - 22;
    const fieldLines = fields.map(([, value]) => wrapLines(value, valueWidth, 'Helvetica', 8.5));
    const lineHeight = 10.5;
    const height = 16 + fieldLines.reduce((sum, lines) => sum + Math.max(1, lines.length) * lineHeight + 5, 0);
    if (doc.y + height > contentBottom) addPage();
    const y = doc.y;
    doc.roundedRect(left, y, width, height, 6).fillAndStroke('#fbfdfb', COLORS.line);
    let fieldY = y + 9;
    fields.forEach(([label, value], fieldIndex) => {
      const lines = fieldLines[fieldIndex];
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted)
        .text(label, left + 10, fieldY, { width: labelWidth });
      doc.font('Helvetica').fontSize(8.5).fillColor('#26362d')
        .text(lines.join('\n'), left + labelWidth + 10, fieldY, { width: valueWidth, lineGap: 1.5 });
      fieldY += Math.max(1, lines.length) * lineHeight + 5;
    });
    doc.y = y + height + 8;
  }

  const classification = assessment.classification || {};
  const classificationLabel = classification.labelLocalized || readable(classification.primary);
  const activeRegimes = (assessment.regimes || [])
    .filter(regime => ['APPLICABLE', 'POSSIBLY_APPLICABLE', 'REVIEW_RECOMMENDED'].includes(regime.relevance));
  const selectedMarkets = (facts.targetMarkets || []).map(market => market === 'OTHER'
    ? (facts.targetMarketOther || 'Custom country')
    : ({ EU: 'European Union', US: 'United States', UAE: 'United Arab Emirates' }[market] || market));

  // Branded cover page.
  doc.moveDown(1.2);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.leaf).text('IP-SAKTI SAHAYAK - DECISION SUPPORT');
  doc.moveDown(.3);
  doc.font('Helvetica-Bold').fontSize(28).fillColor(COLORS.deep).text('Decision Brief');
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.muted).text('Assessment + evidence appendix');
  doc.moveDown(1.1);
  doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.ink).text(textValue(kase.productName || kase.title), { width });
  doc.moveDown(.25);
  drawParagraph(`${jurisdiction} answer set - ${language === 'hi' ? 'Hindi' : 'English'} - case ${kase.publicId}`, { size: 9, color: COLORS.muted });
  doc.moveDown(.9);
  table(['Case', 'Assessment', 'Decision lens'], [[kase.publicId, assessmentDate, jurisdiction]], [width * .35, width * .25, width * .4], { maxLines: 2 });
  callout('How to use this brief', 'This report explains what the recorded facts suggest, why the decision-support engine reached that result, what remains uncertain and what to verify next. It is not a legal opinion, regulatory approval or patentability decision.', 'gold');
  heading('Executive decision', 'At a glance');
  keyValue('Product appears to be', classificationLabel);
  keyValue('Confidence', `${readable(assessment.confidence)} - ${assessment.confidence === 'HIGH' ? 'strong alignment across recorded facts and evidence' : assessment.confidence === 'MEDIUM' ? 'useful for planning, with confirmation still needed' : 'important facts or evidence remain limited'}`);
  keyValue('Human review', assessment.humanReview?.required ? 'Recommended before relying on this result' : 'Not required by the current escalation rules, but professional verification remains prudent');
  drawParagraph(assessment.narrative?.assessment || classification.rationale, { size: 10, bold: true, color: COLORS.deep });
  addPage();

  // What the user told us.
  heading('What you told us', '01 - recorded case facts');
  keyValue('Product description', kase.productDescription);
  keyValue('Ingredients', (facts.ingredients || []).map(item => item.name).join(', '));
  keyValue('Claims', (facts.claims || []).join('; '));
  keyValue('Intended use', readable(facts.intendedUse));
  keyValue('Dosage form / route', `${readable(facts.dosageForm)} / ${readable(facts.routeOfAdministration)}`);
  keyValue('Classical basis', readable(facts.classicalSource));
  keyValue('Commercial intent', readable(facts.commercialIntent));
  keyValue('Target markets', selectedMarkets.length ? selectedMarkets.join(', ') : 'Not selected');
  if (facts.processDescription) keyValue('Process detail', facts.processDescription);

  heading('What this means', '02 - conclusion and boundaries');
  drawParagraph(assessment.narrative?.meaning || 'The current evidence and rule screens should be reviewed together with the decision snapshot in the workspace.');
  if (activeRegimes.length) {
    table(['Area to check', 'Current signal', 'Why it appears', 'First verification step'], activeRegimes.slice(0, 10).map(regime => [
      regime.label || readable(regime.regime), readable(regime.relevance), regime.why || '-', (regime.whatToDo || [])[0] || '-'
    ]), [125, 70, 175, width - 370], { maxLines: 6 });
  } else drawParagraph('No major regime is currently indicated from the stored facts.', { color: COLORS.muted });
  if (assessment.jurisdictionMode === 'INTL') callout('International boundary', 'Treaty systems and route pointers do not replace the law of the target country. Classification, claims, labelling, safety, importer and local licensing checks remain country-specific.', 'gold');
  else callout('India boundary', 'This assessment uses the India corpus only. It does not establish approval, licence status or patentability for this formulation.', 'gold');

  heading('Priority next steps', '03 - start here');
  const actions = [...(assessment.actions || [])].sort((a, b) => (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2));
  if (actions.length) table(['Priority', 'Action', 'Why it matters', 'Professional help'], actions.slice(0, 12).map(action => [
    readable(action.priority), action.title, action.why || '-', action.requiresProfessional ? 'Recommended' : 'Not flagged'
  ]), [58, 170, 195, width - 423], { maxLines: 6 });
  else drawParagraph('No action items were generated. Re-run the assessment after recording more product facts.', { color: COLORS.muted });

  heading('Risks and unresolved information', '04 - what could change the result');
  for (const risk of assessment.risks || []) bullet(`[${readable(risk.severity)}] ${risk.description}`);
  for (const unknown of assessment.unknowns || []) bullet(unknown);
  if (assessment.humanReview?.reason) callout('Before relying on this', `${assessment.humanReview.reason} Recommended professional: ${assessment.humanReview.recommendedProfessional || 'qualified regulatory or IP professional'}.`, 'red');

  if (assessment.jurisdictionMode === 'INTL' || selectedMarkets.length) {
    heading('International target-market plan', '05 - checklists, not approvals');
    keyValue('Selected markets', selectedMarkets.length ? selectedMarkets.join(', ') : 'None - select markets in the workspace');
    drawParagraph('Each route below is a planning checklist. Treaty-level pointers do not replace target-country law.');
    const routes = (assessment.marketRoutes || []).filter(route => route.id !== 'WIPO');
    if (routes.length) table(['Market / route', 'Status', 'Authority', 'Checklist'], routes.map(route => [
      route.name, readable(route.status), route.authority, (route.steps || []).join(' - ')
    ]), [118, 88, 125, width - 331], { maxLines: 8 });
    if (selectedMarkets.includes('Custom country')) callout('Custom country', 'No country-specific law has been inferred. Identify the regulator and verify classification, claims, ingredients, quality, safety, labelling, import and local licensing requirements directly.', 'gold');
  }

  if (assessment.userSummary) {
    heading('Plain-language summary', '06 - generated on request');
    drawParagraph(assessment.userSummary.overview, { bold: true, color: COLORS.deep });
    for (const point of assessment.userSummary.keyPoints || []) bullet(point);
    if (assessment.userSummary.nextSteps?.length) {
      drawParagraph('Next steps', { bold: true, color: COLORS.green });
      for (const step of assessment.userSummary.nextSteps) bullet(step);
    }
    drawParagraph(assessment.userSummary.caveat, { size: 8.5, color: COLORS.muted });
  }

  heading('Evidence appendix', '07 - source traceability');
  drawParagraph('Each card records the claim used, its authority, section, status, verification result and official URL. Verification is jurisdiction-scoped; an International source is not used as an India conclusion.', { color: COLORS.muted });
  const evidence = assessment.evidence || [];
  if (!evidence.length) drawParagraph('No evidence claims were stored for this assessment.', { color: COLORS.muted });
  else evidence.forEach((ev, index) => evidenceCard(ev, index));

  heading('Human review handoff', '08 - controlled professional review');
  keyValue('Required', assessment.humanReview?.required ? 'Yes' : 'No by current rules');
  keyValue('Reason', assessment.humanReview?.reason);
  keyValue('Recommended professional', assessment.humanReview?.recommendedProfessional);
  if (assessment.llmUsed === false) callout('Offline / deterministic mode', 'This brief was prepared without an available AI provider. The deterministic assessment path was used and no AI explanation was presented as AI-generated.', 'gold');
  callout('Final limitation', 'Review the current official source, product facts and target-country requirements before filing, manufacturing, advertising, importing or selling. Obtain professional advice for decisions that affect rights, licences or market access.', 'gold');

  // Page numbers must be drawn only after every page exists; drawing them while
  // pages are being created used to produce the same count on every page.
  const pageRange = doc.bufferedPageRange();
  for (let pageIndex = pageRange.start; pageIndex < pageRange.start + pageRange.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    drawFooter(pageIndex - pageRange.start + 1, pageRange.count);
  }
  doc.end();
  return done;
}
