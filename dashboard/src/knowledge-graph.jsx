import React, { useMemo } from 'react';

/**
 * Compact SVG knowledge graph for a case.
 * Nodes: product, ingredients, classification, regimes (top 4), evidence (top 3).
 * Edges: has_ingredient, classified_as, regulated_by, supported_by.
 */

const W = 720, H = 360;
const CATEGORIES = {
  product: { color: '#14532f', text: '#fff', label: 'PRODUCT' },
  ingredient: { color: '#1f7a4d', text: '#fff', label: 'INGREDIENT' },
  classification: { color: '#d97706', text: '#fff', label: 'CLASSIFICATION' },
  regime: { color: '#6655e8', text: '#fff', label: 'REGIME' },
  evidence: { color: '#6b7a70', text: '#fff', label: 'EVIDENCE' }
};

function layoutNodes(count, cx, cy, rx, ry, startAngle = -Math.PI / 2) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const angle = startAngle + (i / count) * 2 * Math.PI;
    out.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return out;
}

export function KnowledgeGraph({ kase }) {
  const data = useMemo(() => {
    if (!kase) return { nodes: [], edges: [] };
    const facts = kase.facts || {};
    const a = kase.latestAssessment;
    const productName = kase.productName || kase.title || 'Product';
    const ingredients = (facts.ingredients || []).slice(0, 4);
    const classification = (a?.classification?.labelLocalized || a?.classification?.primary || '—').replaceAll('_', ' ');
    const regimes = (a?.regimes || []).filter(r => ['APPLICABLE', 'POSSIBLY_APPLICABLE'].includes(r.relevance)).slice(0, 4);
    const evidence = (a?.evidence || []).filter(e => e.verified).slice(0, 3);

    const productPos = { x: W / 2, y: 56 };
    const ingPos = layoutNodes(ingredients.length || 1, W / 2, 180, 160, 30, -Math.PI / 2);
    const regimePos = layoutNodes(regimes.length || 1, W / 2, 280, 200, 30, Math.PI / 2 + Math.PI / 6);
    const classPos = { x: W - 100, y: 90 };
    const evPos = layoutNodes(evidence.length || 1, 100, 280, 80, 30, -Math.PI / 2);

    const nodes = [
      { id: 'product', x: productPos.x, y: productPos.y, label: productName.slice(0, 26), category: 'product' },
      { id: 'classification', x: classPos.x, y: classPos.y, label: classification.slice(0, 30), category: 'classification' },
      ...ingredients.map((ing, i) => ({ id: `ing-${i}`, x: ingPos[i]?.x || 0, y: ingPos[i]?.y || 0, label: (ing.name || '').slice(0, 18), category: 'ingredient' })),
      ...regimes.map((r, i) => ({ id: `reg-${i}`, x: regimePos[i]?.x || 0, y: regimePos[i]?.y || 0, label: (r.labelLocalized || r.label || r.regime).slice(0, 22), category: 'regime' })),
      ...evidence.map((e, i) => ({ id: `ev-${i}`, x: evPos[i]?.x || 0, y: evPos[i]?.y || 0, label: (e.sourceTitle || '').slice(0, 22), category: 'evidence' }))
    ];
    const edges = [];
    for (let i = 0; i < ingredients.length; i++) edges.push({ from: 'product', to: `ing-${i}`, kind: 'ingredient' });
    edges.push({ from: 'product', to: 'classification', kind: 'classification' });
    for (let i = 0; i < regimes.length; i++) edges.push({ from: 'classification', to: `reg-${i}`, kind: 'regime' });
    for (let i = 0; i < Math.min(evidence.length, regimes.length); i++) edges.push({ from: `reg-${i}`, to: `ev-${i}`, kind: 'evidence' });
    return { nodes, edges };
  }, [kase?._id, kase?.latestAssessment?.createdAt]);

  if (!kase?.latestAssessment) return <div className="kg-container" style={{ display: 'grid', placeItems: 'center' }}><p className="muted small">Run the assessment to visualise the case graph.</p></div>;
  return <div className="kg-container">
    <svg className="kg-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Case knowledge graph">
      <defs>
        <marker id="kg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#c3c9d6"/>
        </marker>
      </defs>
      {data.edges.map((e, i) => {
        const from = data.nodes.find(n => n.id === e.from); const to = data.nodes.find(n => n.id === e.to);
        if (!from || !to) return null;
        return <line key={i} className={`kg-edge ${e.kind}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} markerEnd="url(#kg-arrow)"/>;
      })}
      {data.nodes.map(n => <g key={n.id} className="kg-node" transform={`translate(${n.x},${n.y})`}>
        <rect x={-n.label.length * 3.6 - 8} y={-12} width={n.label.length * 7.2 + 16} height={24} rx={12} fill={CATEGORIES[n.category]?.color || '#999'}/>
        <text x={0} y={4} textAnchor="middle" fontSize="11" fontWeight="700" fill={CATEGORIES[n.category]?.text || '#fff'}>{n.label}</text>
      </g>)}
    </svg>
    <div className="kg-legend">
      {Object.entries(CATEGORIES).map(([k, v]) => <span key={k}><i style={{ background: v.color }}/>{v.label}</span>)}
    </div>
  </div>;
}
