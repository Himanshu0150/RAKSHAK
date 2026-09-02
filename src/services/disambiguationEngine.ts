import { Entity, DisambiguationResult, CDRRecord, FinancialTransaction } from '../types/investigation';

function stringSimilarity(str1: string, str2: string): number {
  const s1 = (str1 || '').toLowerCase().trim();
  const s2 = (str2 || '').toLowerCase().trim();
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  // Simple bigram Dice coefficient
  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);
  let intersection = 0;
  bg1.forEach(b => { if (bg2.has(b)) intersection++; });

  return (2.0 * intersection) / (bg1.size + bg2.size || 1);
}

export function compareEntities(
  entityA: Entity, 
  entityB: Entity,
  cdrRecords?: CDRRecord[],
  transactions?: FinancialTransaction[]
): DisambiguationResult {
  const supportingFactors: string[] = [];
  const contradictingFactors: string[] = [];
  const hardContradictions: string[] = [];
  const missingInformation: string[] = [];

  let scoreSum = 0;
  let weightSum = 0;

  // 1. Name Match
  const nameSim = stringSimilarity(entityA.name, entityB.name);
  if (nameSim > 0.85) {
    supportingFactors.push(`High lexical name concordance (${(nameSim * 100).toFixed(0)}% phonetic/string similarity): "${entityA.name}" vs "${entityB.name}".`);
    scoreSum += nameSim * 30;
  } else if (nameSim > 0.5) {
    supportingFactors.push(`Moderate partial name match: "${entityA.name}" vs "${entityB.name}".`);
    scoreSum += nameSim * 15;
  } else {
    contradictingFactors.push(`Disparate names: "${entityA.name}" vs "${entityB.name}".`);
  }
  weightSum += 30;

  // 2. Date of Birth (DOB) Check
  const dobA = entityA.attributes?.dob || entityA.attributes?.date_of_birth || entityA.attributes?.birth_date;
  const dobB = entityB.attributes?.dob || entityB.attributes?.date_of_birth || entityB.attributes?.birth_date;

  if (dobA && dobB) {
    if (String(dobA) === String(dobB)) {
      supportingFactors.push(`Identical recorded Date of Birth: ${dobA}.`);
      scoreSum += 35;
    } else {
      const yearA = parseInt(String(dobA).slice(0, 4), 10);
      const yearB = parseInt(String(dobB).slice(0, 4), 10);
      if (!isNaN(yearA) && !isNaN(yearB) && Math.abs(yearA - yearB) >= 7) {
        hardContradictions.push(`CRITICAL HARD CONTRADICTION: Severe age disparity of ${Math.abs(yearA - yearB)} years (${dobA} vs ${dobB}). Biologically incompatible identity.`);
      } else {
        contradictingFactors.push(`Recorded DOB discrepancy: ${dobA} vs ${dobB}.`);
      }
    }
    weightSum += 35;
  } else {
    missingInformation.push('Verified Date of Birth missing for one or both candidate records.');
  }

  // 3. Phone overlap & CDR co-location
  const phoneA = entityA.attributes?.phone || entityA.attributes?.msisdn || entityA.attributes?.mobile;
  const phoneB = entityB.attributes?.phone || entityB.attributes?.msisdn || entityB.attributes?.mobile;

  if (phoneA && phoneB) {
    if (String(phoneA).replace(/\D/g, '') === String(phoneB).replace(/\D/g, '')) {
      supportingFactors.push(`Shared MSISDN / Mobile Number: ${phoneA}.`);
      scoreSum += 25;
    } else {
      contradictingFactors.push(`Distinct primary phone identifiers (${phoneA} vs ${phoneB}).`);
    }
    weightSum += 25;
  } else {
    missingInformation.push('Primary telecom MSISDN not cross-referenced on both records.');
  }

  // Optional CDR analysis check if CDRs supplied
  if (cdrRecords && cdrRecords.length > 0 && phoneA && phoneB) {
    const pA = String(phoneA).replace(/\D/g, '');
    const pB = String(phoneB).replace(/\D/g, '');
    const cdrsA = cdrRecords.filter(c => String(c.callerPhone || '').replace(/\D/g, '').includes(pA) || String(c.receiverPhone || '').replace(/\D/g, '').includes(pA));
    const cdrsB = cdrRecords.filter(c => String(c.callerPhone || '').replace(/\D/g, '').includes(pB) || String(c.receiverPhone || '').replace(/\D/g, '').includes(pB));
    const towersA = new Set(cdrsA.map(c => c.cellTowerLocation));
    const sharedTowers = Array.from(towersA).filter(t => cdrsB.some(c => c.cellTowerLocation === t));
    if (sharedTowers.length > 0) {
      supportingFactors.push(`Cellular Tower Co-location: Both entities operated within shared sector towers [${sharedTowers.slice(0, 2).join(', ')}].`);
      scoreSum += 15;
      weightSum += 15;
    }
  }

  // 4. Address / State / District Location
  const locA = entityA.attributes?.location || entityA.attributes?.address || entityA.attributes?.state || entityA.attributes?.district;
  const locB = entityB.attributes?.location || entityB.attributes?.address || entityB.attributes?.state || entityB.attributes?.district;

  if (locA && locB) {
    const locSim = stringSimilarity(String(locA), String(locB));
    if (locSim > 0.7) {
      supportingFactors.push(`Geographic / State alignment: "${locA}" aligns with "${locB}".`);
      scoreSum += 20;
    } else {
      contradictingFactors.push(`Geographic / Jurisdiction variance: "${locA}" vs "${locB}".`);
    }
    weightSum += 20;
  } else {
    missingInformation.push('Residential jurisdiction or verified address missing.');
  }

  // 5. State & District exact comparison
  const stateA = entityA.attributes?.state;
  const stateB = entityB.attributes?.state;
  const distA = entityA.attributes?.district;
  const distB = entityB.attributes?.district;
  if (stateA && stateB) {
    if (String(stateA).toLowerCase() === String(stateB).toLowerCase()) {
      supportingFactors.push(`Identical State Jurisdiction: ${stateA}.`);
      scoreSum += 15;
      weightSum += 15;
    } else {
      contradictingFactors.push(`Cross-state jurisdictional divergence: ${stateA} vs ${stateB}.`);
      weightSum += 15;
    }
  }
  if (distA && distB) {
    if (String(distA).toLowerCase() === String(distB).toLowerCase()) {
      supportingFactors.push(`Identical Police District: ${distA}.`);
      scoreSum += 15;
      weightSum += 15;
    } else {
      contradictingFactors.push(`Divergent Police District: ${distA} vs ${distB}.`);
      weightSum += 15;
    }
  }

  // 6. Account / Asset overlaps & Financials
  const accA = entityA.attributes?.account_number || entityA.attributes?.bank_account;
  const accB = entityB.attributes?.account_number || entityB.attributes?.bank_account;
  if (accA && accB) {
    if (String(accA) === String(accB)) {
      supportingFactors.push(`Exact bank account identifier match: ${accA}.`);
      scoreSum += 30;
      weightSum += 30;
    }
  }

  if (transactions && transactions.length > 0) {
    const directTx = transactions.filter(
      t => (t.sourceOwnerName?.toLowerCase().includes(entityA.name.toLowerCase()) && t.targetOwnerName?.toLowerCase().includes(entityB.name.toLowerCase())) ||
           (t.sourceOwnerName?.toLowerCase().includes(entityB.name.toLowerCase()) && t.targetOwnerName?.toLowerCase().includes(entityA.name.toLowerCase()))
    );
    if (directTx.length > 0) {
      supportingFactors.push(`Direct financial flow documented: ${directTx.length} bilateral transaction(s) recorded between accounts.`);
      scoreSum += 20;
      weightSum += 20;
    }
  }

  // 7. Case linkage overlap
  const commonCases = (entityA.linkedCaseIds || []).filter(c => (entityB.linkedCaseIds || []).includes(c));
  if (commonCases.length > 0) {
    supportingFactors.push(`Concurrent involvement in ${commonCases.length} joint investigation case(s) [${commonCases.join(', ')}].`);
    scoreSum += 15;
    weightSum += 15;
  }

  // Compute final similarity score and independent confidence score
  const finalScore = weightSum > 0 ? Math.min(100, Math.round((scoreSum / weightSum) * 100)) : 0;
  let verdict: 'SAME' | 'DIFFERENT' | 'UNCERTAIN' = 'UNCERTAIN';
  
  let confidence = 50;
  if (weightSum === 0) {
    confidence = 0; // Not available
  } else if (hardContradictions.length > 0) {
    verdict = 'DIFFERENT';
    // Calculate custom score for this specific entity pair based on attribute alignment
    confidence = Math.min(99, Math.max(62, Math.round(82 + (contradictingFactors.length * 3) + (hardContradictions.length * 4) - (supportingFactors.length * 3))));
  } else if (finalScore >= 75 && supportingFactors.length >= 2) {
    verdict = 'SAME';
    confidence = Math.min(98, Math.max(78, finalScore));
  } else if (finalScore <= 35 || contradictingFactors.length >= 2) {
    verdict = 'DIFFERENT';
    confidence = Math.min(97, Math.max(65, Math.round(70 + (contradictingFactors.length * 4))));
  } else {
    verdict = 'UNCERTAIN';
    confidence = Math.min(75, Math.max(45, Math.round(50 + (supportingFactors.length * 5))));
  }

  let recommendation = '';
  if (verdict === 'SAME') {
    recommendation = `High analytical confidence to merge or alias these records under unified master entity. Retain primary cross-references.`;
  } else if (verdict === 'DIFFERENT') {
    recommendation = `Do NOT merge. Distinct physical identities established with ${hardContradictions.length > 0 ? 'hard contradictions' : 'substantial divergent attributes'}.`;
  } else {
    recommendation = `Insufficient verifiable anchors to confirm identity deduplication. Require CDR tower cross-triangulation or forensic biometric review.`;
  }

  return {
    entityAId: entityA.id,
    entityBId: entityB.id,
    entityAName: entityA.name,
    entityBName: entityB.name,
    similarityScore: finalScore,
    verdict,
    confidence,
    supportingFactors,
    contradictingFactors,
    hardContradictions,
    missingInformation,
    recommendation
  };
}

export const disambiguateEntityPair = compareEntities;


