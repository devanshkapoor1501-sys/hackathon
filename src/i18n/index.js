// Bilingual label layer (en/hi). Rules engines stay English-canonical;
// rendering, questions and reports translate through this module.

export const LANGUAGES = { en: 'English', hi: 'हिन्दी (Hindi)' };

const CLASSIFICATION_LABELS = {
  en: {
    CLASSICAL_ASU_MEDICINE: 'Classical Ayurvedic medicine (ASU drug)',
    PROPRIETARY_ASU_MEDICINE: 'Patent/Proprietary ASU medicine candidate',
    NEW_ASU_CANDIDATE_REVIEW: 'New/non-classical product requiring further assessment',
    AYURVEDA_AAHARA: 'Ayurveda Aahara (Ayurvedic principles-based food)',
    FOOD_NUTRACEUTICAL: 'Food / nutraceutical category candidate',
    COSMETIC: 'Cosmetic',
    PLANT_VARIETY_INNOVATION: 'Plant variety-related innovation',
    RAW_BIORESOURCE_TRADE: 'Raw biological resource trade',
    RESEARCH_BIOLOGICAL_MATERIAL: 'Research-related biological material',
    MIXED_AMBIGUOUS: 'Mixed / ambiguous product',
    UNKNOWN_HUMAN_REVIEW: 'Unknown — human review'
  },
  hi: {
    CLASSICAL_ASU_MEDICINE: 'शास्त्रीय आयुर्वेदिक औषधि (ASU ड्रग)',
    PROPRIETARY_ASU_MEDICINE: 'पेटेंट/प्रोप्राइटरी ASU औषधि संभाव्य',
    NEW_ASU_CANDIDATE_REVIEW: 'नया/अशास्त्रीय उत्पाद — अधिक मूल्यांकन आवश्यक',
    AYURVEDA_AAHARA: 'आयुर्वेद आहार (आयुर्वेदिक सिद्धांतों पर आधारित खाद्य)',
    FOOD_NUTRACEUTICAL: 'खाद्य / न्यूट्रास्युटिकल श्रेणी संभाव्य',
    COSMETIC: 'सौंदर्य प्रसाधन (कॉस्मेटिक)',
    PLANT_VARIETY_INNOVATION: 'पादप प्रजाति संबंधी नवाचार',
    RAW_BIORESOURCE_TRADE: 'जैविक संसाधन का कच्चा व्यापार',
    RESEARCH_BIOLOGICAL_MATERIAL: 'अनुसंधान-संबंधी जैविक सामग्री',
    MIXED_AMBIGUOUS: 'मिश्रित / अस्पष्ट उत्पाद',
    UNKNOWN_HUMAN_REVIEW: 'अज्ञात — मानवीय समीक्षा आवश्यक'
  }
};

const REGIME_LABELS = {
  en: {
    AYUSH: 'AYUSH / ASU medicines', FOOD: 'Food safety (FSSAI)', COSMETIC: 'Cosmetics',
    PATENT: 'Patents (Patents Act, 1970)', TRADEMARK: 'Trademarks (Trade Marks Act, 1999)',
    GI: 'Geographical Indications', DESIGN: 'Designs', COPYRIGHT: 'Copyright',
    PLANT_VARIETY: 'Plant variety protection (PPV&FR)', BIODIVERSITY_ABS: 'Biodiversity / ABS (Biological Diversity Act)',
    TRADITIONAL_KNOWLEDGE: 'Traditional knowledge screening', LABELLING_CLAIMS: 'Labelling & claims',
    TRIPS: 'TRIPS baseline (WTO)', CBD_NAGOYA: 'CBD / Nagoya Protocol', WIPO_GRATK: 'WIPO genetic resources & TK treaty',
    PCT: 'PCT international patent route', MADRID: 'Madrid international trademark route', HAGUE: 'Hague international design route',
    BUDAPEST: 'Budapest microorganism deposit route', EXPORT_MARKET_ACCESS: 'Export-market regulatory access', OTHER: 'Other'
  },
  hi: {
    AYUSH: 'आयुष / ASU औषधि (औषधि एवं सौंदर्य प्रसाधन अधिनियम)', FOOD: 'खाद्य सुरक्षा (FSSAI)', COSMETIC: 'सौंदर्य प्रसाधन',
    PATENT: 'पेटेंट (पेटेंट अधिनियम, 1970)', TRADEMARK: 'व्यापार चिह्न (ट्रेड मार्क्स अधिनियम, 1999)',
    GI: 'भौगोलिक संकेत', DESIGN: 'डिज़ाइन', COPYRIGHT: 'कॉपीराइट',
    PLANT_VARIETY: 'पादप प्रजाति संरक्षण (PPV&FR)', BIODIVERSITY_ABS: 'जैव विविधता / ABS (जैव विविधता अधिनियम)',
    TRADITIONAL_KNOWLEDGE: 'परंपरागत ज्ञान जाँच', LABELLING_CLAIMS: 'लेबलिंग एवं दावे',
    TRIPS: 'TRIPS आधार (WTO)', CBD_NAGOYA: 'CBD / नागोया प्रोटोकॉल', WIPO_GRATK: 'WIPO आनुवंशिक संसाधन एवं TK संधि',
    PCT: 'PCT अंतरराष्ट्रीय पेटेंट मार्ग', MADRID: 'मैड्रिड अंतरराष्ट्रीय ट्रेडमार्क मार्ग', HAGUE: 'हेग अंतरराष्ट्रीय डिज़ाइन मार्ग',
    BUDAPEST: 'बुडापेस्ट सूक्ष्मजीव जमा मार्ग', EXPORT_MARKET_ACCESS: 'निर्यात-बाज़ार नियामक पहुँच', OTHER: 'अन्य'
  }
};

const RELEVANCE_LABELS = {
  en: { APPLICABLE: 'Applicable', POSSIBLY_APPLICABLE: 'Possibly applicable', REVIEW_RECOMMENDED: 'Review recommended', INSUFFICIENT_INFORMATION: 'Insufficient information', NOT_CURRENTLY_INDICATED: 'Not currently indicated' },
  hi: { APPLICABLE: 'लागू होता प्रतीत होता है', POSSIBLY_APPLICABLE: 'संभवतः लागू', REVIEW_RECOMMENDED: 'समीक्षा अनुशंसित', INSUFFICIENT_INFORMATION: 'अपर्याप्त जानकारी', NOT_CURRENTLY_INDICATED: 'इस समय लागू नहीं' }
};

const CONFIDENCE_LABELS = {
  en: { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low', ESCALATE: 'Escalate' },
  hi: { HIGH: 'उच्च', MEDIUM: 'मध्यम', LOW: 'निम्न', ESCALATE: 'विशेषज्ञ को भेजें' }
};

const QUESTIONS = {
  en: {
    intendedUse: { question: 'What is this product intended to do?', why: 'Intended use decides whether this is regulated as a medicine, food, or cosmetic in India.' },
    claims: { question: 'What exact claims will you make on the label or marketing?', why: 'Claims are decisive: disease claims push products into drug regulation; food claims keep them under FSSAI.' },
    dosageForm: { question: 'What form is the product in (tablet, capsule, powder, oil, cream…)?', why: 'Dosage form helps identify the applicable product category and licensing pathway.' },
    routeOfAdministration: { question: 'How is it used — swallowed (oral) or applied on the body (topical)?', why: 'Route of administration separates medicines/cosmetics from foods.' },
    classicalSource: { question: 'Is this formulation taken from an authoritative Ayurvedic text (e.g., Charaka Samhita)? If yes, which one?', why: 'This determines classical vs proprietary ASU classification, which changes the regulatory path.' },
    commercialIntent: { question: 'Do you intend to sell this commercially in India, or is it for research/personal use?', why: 'Commercial sale triggers licensing and labelling obligations; research does not (yet).' },
    newProcess: { question: 'Does your extraction/manufacturing process differ from standard traditional methods? Describe what is new.', why: 'A genuinely new process may be patent-relevant subject matter (subject to s.3(d)/3(p)).' }
  },
  hi: {
    intendedUse: { question: 'यह उत्पाद किस उद्देश्य से बनाया गया है?', why: 'उद्देश्य तय करता है कि यह भारत में औषधि, खाद्य या कॉस्मेटिक के रूप में नियमित होगा।' },
    claims: { question: 'आप लेबल या विज्ञापन पर क्या दावे करेंगे?', why: 'दावे निर्णायक हैं: रोग-दावे उत्पाद को औषधि नियमन में डालते हैं; खाद्य दावे FSSAI के अंतर्गत रखते हैं।' },
    dosageForm: { question: 'उत्पाद किस रूप में है (टैबलेट, कैप्सूल, चूर्ण, तेल, क्रीम…)?', why: 'रूप से लागू श्रेणी एवं लाइसेंसिंग मार्ग पहचानने में मदद मिलती है।' },
    routeOfAdministration: { question: 'इसका उपयोग कैसे होता है — निगलकर (मौखिक) या शरीर पर लगाकर?', why: 'उपयोग की विधि औषधि/कॉस्मेटिक और खाद्य को अलग करती है।' },
    classicalSource: { question: 'क्या यह मिश्रण किसी प्रामाणिक आयुर्वेदिक ग्रंथ (जैसे चरक संहिता) से लिया गया है? यदि हाँ, तो किससे?', why: 'इससे शास्त्रीय बनाम प्रोप्राइटरी ASU वर्गीकरण तय होता है, जो नियामक मार्ग बदलता है।' },
    commercialIntent: { question: 'क्या आप इसे भारत में व्यावसायिक रूप से बेचना चाहते हैं, या यह अनुसंधान/व्यक्तिगत उपयोग के लिए है?', why: 'व्यावसायिक बिक्री से लाइसेंसिंग व लेबलिंग दायित्व उत्पन्न होते हैं; अनुसंधान से नहीं (अभी)।' },
    newProcess: { question: 'क्या आपकी निष्कर्षण/निर्माण प्रक्रिया पारंपरिक विधियों से भिन्न है? नई बात बताइए।', why: 'वास्तव में नई प्रक्रिया पेटेंट-प्रासंगिक विषय-वस्तु हो सकती है (धारा 3(d)/3(p) के अधीन)।' }
  }
};

const REPORT_STRINGS = {
  en: {
    title: 'IP-SAKTI Sahayak — Case Assessment Report',
    disclaimer: 'Decision-support output only. Not legal advice. Verify with qualified professionals before acting.',
    sections: { classification: 'Product Classification', regimes: 'Potentially Applicable Indian Regimes', actions: 'Action Plan', risks: 'Risks', evidence: 'Evidence & Citations', unknowns: 'Unknown Information', confidence: 'Confidence', review: 'Human Review', abs: 'Biodiversity / ABS Screen', tk: 'Traditional Knowledge / Section 3(p)' }
  },
  hi: {
    title: 'IP-SAKTI सहायक — मूल्यांकन रिपोर्ट',
    disclaimer: 'यह केवल निर्णय-सहायता आउटपुट है। यह कानूनी सलाह नहीं है। कार्य करने से पहले योग्य पेशेवर से सत्यापित करें।',
    sections: { classification: 'उत्पाद वर्गीकरण', regimes: 'संभावित रूप से लागू भारतीय विधि-क्षेत्र', actions: 'कार्य योजना', risks: 'जोखिम', evidence: 'साक्ष्य एवं संदर्भ', unknowns: 'अज्ञात जानकारी', confidence: 'विश्वास स्तर', review: 'मानवीय समीक्षा', abs: 'जैव विविधता / ABS जाँच', tk: 'परंपरागत ज्ञान / धारा 3(p)' }
  }
};

export function t(lang, dictionary, key) {
  const dict = { CLASSIFICATION_LABELS, REGIME_LABELS, RELEVANCE_LABELS, CONFIDENCE_LABELS, QUESTIONS, REPORT_STRINGS }[dictionary];
  if (!dict) return key;
  return dict[lang]?.[key] ?? dict.en[key] ?? key;
}

export function questionIn(lang, key) {
  const entry = QUESTIONS[lang]?.[key] ?? QUESTIONS.en[key];
  return entry || { question: key, why: '' };
}

export function normalizeLanguage(input) {
  return input === 'hi' ? 'hi' : 'en';
}
