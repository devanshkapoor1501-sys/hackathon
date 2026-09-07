import React, { useState } from 'react';
import { CircleHelp, ChevronDown } from 'lucide-react';

export function InlineHelp({ id, title, body, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return <div className={`inline-help ${open ? 'open' : ''}`}>
    <button type="button" className="inline-help-trigger" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={`help-${id}`}>
      <CircleHelp size={14}/> How this works
      <ChevronDown size={13} className={`chev ${open ? 'open' : ''}`}/>
    </button>
    {open && <div className="inline-help-body" id={`help-${id}`}>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>}
  </div>;
}

export function HelpLink({ onClick, children }) {
  return <button type="button" className="help-link" onClick={onClick}><CircleHelp size={12}/>{children}</button>;
}
