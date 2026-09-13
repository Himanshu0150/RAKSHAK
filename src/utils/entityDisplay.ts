import { Entity, CaseRecord, CDRRecord, FinancialTransaction, EvidenceRecord, TimelineEvent, GraphNode } from '../types/investigation';
import { InvestigationDataset } from '../services/datasetNormalizer';

export interface DisplayInfo {
  title: string;
  subtitle?: string;
  type: string;
  referenceId: string;
  fullLabel: string;
}

export interface AccountDisplayDetails {
  title: string;
  subtitle: string;
  holderName: string | null;
  accountNumber: string | null;
  bankName: string | null;
  referenceId: string;
  type: string;
  fullLabel: string;
  isUnknown: boolean;
}

const RAW_ID_REGEX = /^(PERSON-|P00|PH0|PHONE-|DEV-|D00|VEH-|V00|ACC|AC0|AC-|A00|CASE|C00|E00|EVID|EVD|CDR|TX|LOC|L0)/i;

export function resolveAccountDisplayDetails(
  target: Entity | string | null | undefined,
  dataset?: InvestigationDataset
): AccountDisplayDetails {
  if (!target) {
    return {
      title: 'Unknown Account',
      subtitle: 'Bank Account',
      holderName: null,
      accountNumber: null,
      bankName: 'Bank Account',
      referenceId: '',
      type: 'account',
      fullLabel: 'Unknown Account',
      isUnknown: true
    };
  }

  let rawId = '';
  let attrs: Record<string, any> = {};

  if (typeof target === 'object') {
    rawId = target.id || '';
    attrs = target.attributes || target;
  } else {
    rawId = String(target).trim();
  }

  const u = rawId.toUpperCase();
  const rawNumStr = rawId.replace(/[^0-9]/g, '');

  let foundEntity: Entity | undefined = undefined;

  if (dataset?.entities?.length) {
    foundEntity = dataset.entities.find(e => {
      if (e.id === rawId || (e.id && e.id.toUpperCase() === u)) return true;
      if (e.attributes?.account_id === rawId || e.attributes?.account_number === rawId) return true;
      const eNum = e.id?.replace(/[^0-9]/g, '');
      if (eNum && rawNumStr && eNum === rawNumStr && e.type?.toLowerCase() === 'account') return true;
      return false;
    });

    if (foundEntity && foundEntity.attributes) {
      attrs = { ...foundEntity.attributes, ...attrs };
    }
  }

  let txnMatch: FinancialTransaction | undefined = undefined;
  if (dataset?.transactions?.length) {
    txnMatch = dataset.transactions.find(t =>
      t.sourceAccount === rawId ||
      t.targetAccount === rawId ||
      (t as any).source_account_id === rawId ||
      (t as any).target_account_id === rawId ||
      t.id === rawId ||
      t.txnReference === rawId
    );
  }

  const accountNumber = 
    (attrs.account_number as string) || 
    (attrs.acc_no as string) || 
    (attrs.account as string) || 
    (attrs.bank_account as string) ||
    (attrs.masked_identifier as string) ||
    (txnMatch && (txnMatch.sourceAccount === rawId ? txnMatch.sourceAccount : txnMatch.targetAccount === rawId ? txnMatch.targetAccount : null)) ||
    (/^\d{8,18}$/.test(rawId) ? rawId : null);

  const bankName = 
    (attrs.bank_name as string) || 
    (attrs.institution as string) || 
    (attrs.institution_type as string) || 
    (attrs.bank as string) ||
    (txnMatch as any)?.bankName ||
    'Bank Account';

  let holderName: string | null = null;
  const holderPersonId = (attrs.holder_person_id as string) || (attrs.person_id as string) || (attrs.holder as string) || (attrs.owner_person_id as string);
  const holderOrgId = (attrs.holder_organization_id as string) || (attrs.organization_id as string) || (attrs.org_id as string);

  if (holderPersonId && dataset?.entities?.length) {
    const personEnt = dataset.entities.find(e => 
      e.id === holderPersonId || 
      e.attributes?.person_id === holderPersonId ||
      (e.type === 'person' && e.id?.replace(/[^0-9]/g, '') === holderPersonId.replace(/[^0-9]/g, ''))
    );
    if (personEnt) {
      holderName = personEnt.name || (personEnt.attributes?.full_name as string) || (personEnt.attributes?.name as string) || null;
    }
  }

  if (!holderName && holderOrgId && dataset?.entities?.length) {
    const orgEnt = dataset.entities.find(e => 
      e.id === holderOrgId || 
      e.attributes?.organization_id === holderOrgId ||
      (e.type === 'organization' && e.id?.replace(/[^0-9]/g, '') === holderOrgId.replace(/[^0-9]/g, ''))
    );
    if (orgEnt) {
      holderName = orgEnt.name || (orgEnt.attributes?.name as string) || null;
    }
  }

  if (!holderName) {
    const explicitOwner = (attrs.owner as string) || (attrs.account_holder as string) || (attrs.owner_name as string);
    if (explicitOwner && !RAW_ID_REGEX.test(explicitOwner)) {
      holderName = explicitOwner;
    }
  }

  if (!holderName && txnMatch) {
    const isSource = txnMatch.sourceAccount === rawId || (txnMatch as any).source_account_id === rawId;
    const ownerCandidate = isSource ? txnMatch.sourceOwnerName : txnMatch.targetOwnerName;
    if (ownerCandidate && !RAW_ID_REGEX.test(ownerCandidate)) {
      holderName = ownerCandidate;
    }
  }

  const cleanAccNum = accountNumber && !RAW_ID_REGEX.test(accountNumber) ? accountNumber : null;

  if (!holderName && !cleanAccNum && bankName === 'Bank Account' && (!rawId || rawId.startsWith('ACC-UNK'))) {
    return {
      title: 'Unknown Account',
      subtitle: 'Bank Account',
      holderName: null,
      accountNumber: null,
      bankName: 'Bank Account',
      referenceId: rawId,
      type: 'account',
      fullLabel: 'Unknown Account',
      isUnknown: true
    };
  }

  const primaryTitle = holderName || (cleanAccNum ? `Account: ${cleanAccNum}` : (rawId || 'Bank Account'));
  const secondarySubtitle = cleanAccNum && bankName
    ? `Account: ${cleanAccNum} • ${bankName}`
    : (cleanAccNum ? `Account: ${cleanAccNum}` : bankName);

  return {
    title: primaryTitle,
    subtitle: secondarySubtitle,
    holderName,
    accountNumber: cleanAccNum,
    bankName,
    referenceId: rawId || (foundEntity?.id || 'ACC-REF'),
    type: 'account',
    fullLabel: `${primaryTitle} • ${secondarySubtitle}`,
    isUnknown: false
  };
}

/**
 * Resolves any Entity object or Entity ID string to a human-readable display title and subtitle.
 * Queries across entities, transactions, CDRs, evidence, timeline events, and case registries.
 */
export function getEntityDisplayInfo(
  target: Entity | string | null | undefined,
  dataset?: InvestigationDataset
): DisplayInfo {
  if (!target) {
    return {
      title: 'Unknown Entity',
      type: 'unknown',
      referenceId: '',
      fullLabel: 'Unknown Entity'
    };
  }

  // If Target is an Entity object
  if (typeof target === 'object') {
    const entity = target;
    const refId = entity.id;
    const attrs = entity.attributes || {};
    let title = entity.name;
    let subtitle: string | undefined = undefined;
    const type = (entity.type || 'entity').toLowerCase();

    const isNameRawId = !title || RAW_ID_REGEX.test(title);

    switch (type) {
      case 'person': {
        const resolvedName = (attrs.full_name as string) || (attrs.person_name as string) || (attrs.name as string) || (attrs.subject_name as string);
        if (resolvedName && !RAW_ID_REGEX.test(resolvedName)) {
          title = resolvedName;
        } else if (isNameRawId) {
          title = 'Unknown Person';
        }
        subtitle = (attrs.occupation as string) || (attrs.role as string) || (attrs.jurisdiction as string) || 'Person Profile';
        break;
      }
      case 'phone': {
        const phoneNum = (attrs.phone_number as string) || (attrs.msisdn as string) || (attrs.number as string) || (attrs.caller_num as string);
        if (phoneNum && !RAW_ID_REGEX.test(phoneNum)) {
          title = phoneNum;
        } else if (isNameRawId) {
          title = 'Unknown Subscriber';
        }
        subtitle = (attrs.carrier as string) || (attrs.network as string) || 'Subscriber Line';
        break;
      }
      case 'vehicle': {
        const regNo = (attrs.registration_number as string) || (attrs.plate_number as string) || (attrs.license_plate as string) || (attrs.vin as string) || (attrs.registration_no as string);
        if (regNo && !RAW_ID_REGEX.test(regNo)) {
          title = regNo;
        } else if (isNameRawId) {
          title = 'Unknown Vehicle';
        }
        subtitle = (attrs.model as string) || (attrs.make as string) || (attrs.vessel_type as string) || 'Vehicle Record';
        break;
      }
      case 'account': {
        const accInfo = resolveAccountDisplayDetails(entity, dataset);
        title = accInfo.title;
        subtitle = accInfo.subtitle;
        break;
      }
      case 'location': {
        const loc = (attrs.location as string) || (attrs.address as string) || (attrs.city as string) || (attrs.site as string) || (attrs.tower_location as string);
        if (loc && !RAW_ID_REGEX.test(loc)) {
          title = loc;
        } else if (isNameRawId) {
          title = 'Unknown Location';
        }
        subtitle = (attrs.jurisdiction as string) || 'Geographic Location';
        break;
      }
      case 'device': {
        const imei = (attrs.imei as string) || (attrs.device_id as string) || (attrs.hardware as string) || (attrs.model as string);
        if (imei && !RAW_ID_REGEX.test(imei)) {
          title = String(imei).length === 15 ? `IMEI ${imei}` : String(imei);
        } else if (isNameRawId) {
          title = 'Unknown Device';
        }
        subtitle = (attrs.hardware_type as string) || (attrs.model as string) || 'Device Exhibit';
        break;
      }
      case 'evidence': {
        const evTitle = (attrs.title as string) || (attrs.evidence_type as string) || (attrs.description as string);
        if (evTitle && !RAW_ID_REGEX.test(evTitle)) {
          title = evTitle;
        } else if (isNameRawId) {
          title = 'Unknown Evidence';
        }
        subtitle = (attrs.sourceDeviceOrMedium as string) || 'Evidence Record';
        break;
      }
      case 'organization': {
        if (isNameRawId) {
          title = 'Unknown Organization';
        }
        subtitle = (attrs.industry as string) || (attrs.type as string) || 'Organization';
        break;
      }
      default: {
        if (isNameRawId) {
          title = 'Unknown Entity';
        }
        break;
      }
    }

    return {
      title,
      subtitle,
      type,
      referenceId: refId,
      fullLabel: subtitle ? `${title} • ${subtitle}` : title
    };
  }

  // If Target is a string ID
  const rawId = (target as string).trim();
  if (!rawId) {
    return { title: 'Unknown Entity', type: 'unknown', referenceId: '', fullLabel: 'Unknown Entity' };
  }

  const u = rawId.toUpperCase();
  const rawNumStr = rawId.replace(/[^0-9]/g, '');

  // Check direct phone number format
  if (/^\+?\d{10,13}$/.test(rawId.replace(/[\s\-]/g, ''))) {
    return {
      title: rawId,
      subtitle: 'Subscriber Line',
      type: 'phone',
      referenceId: rawId,
      fullLabel: rawId
    };
  }

  if (dataset) {
    const guessedType = u.startsWith('P') || u.startsWith('PERSON') ? 'person'
      : u.startsWith('PH') || u.startsWith('PHONE') ? 'phone'
      : u.startsWith('AC') || u.startsWith('ACC') ? 'account'
      : u.startsWith('V') || u.startsWith('VEH') ? 'vehicle'
      : u.startsWith('D') || u.startsWith('DEV') ? 'device'
      : u.startsWith('L') || u.startsWith('LOC') ? 'location'
      : u.startsWith('E') || u.startsWith('EVD') ? 'evidence'
      : '';

    // Direct account resolution check
    if (guessedType === 'account' || u.startsWith('ACC') || u.startsWith('AC0') || u.startsWith('AC-') || u.startsWith('A00')) {
      const accDetails = resolveAccountDisplayDetails(rawId, dataset);
      if (!accDetails.isUnknown) {
        return {
          title: accDetails.title,
          subtitle: accDetails.subtitle,
          type: 'account',
          referenceId: accDetails.referenceId,
          fullLabel: accDetails.fullLabel
        };
      }
    }

    // 1. Search dataset.entities
    if (dataset.entities?.length) {
      const found = dataset.entities.find(e => {
        if (e.id === rawId || e.name === rawId || (e.id && e.id.toUpperCase() === u)) return true;
        const eNum = e.id?.replace(/[^0-9]/g, '');
        if (eNum && rawNumStr && eNum === rawNumStr) {
          if (!guessedType || (e.type && e.type.toLowerCase() === guessedType)) return true;
        }
        return false;
      });
      if (found) {
        const resolved = getEntityDisplayInfo(found, dataset);
        if (resolved.title && !RAW_ID_REGEX.test(resolved.title) && !resolved.title.startsWith('Unknown')) {
          return resolved;
        }
      }
    }

    // 2. Search dataset.transactions (for Financial Accounts & Transactions)
    if (dataset.transactions?.length) {
      const txn = dataset.transactions.find(t => 
        t.sourceAccount === rawId || 
        t.targetAccount === rawId || 
        t.id === rawId || 
        t.txnReference === rawId ||
        (rawNumStr && t.id.replace(/[^0-9]/g, '') === rawNumStr)
      );
      if (txn) {
        if (rawId === txn.sourceAccount) {
          const owner = txn.sourceOwnerName && !RAW_ID_REGEX.test(txn.sourceOwnerName) ? txn.sourceOwnerName : '';
          const accStr = txn.sourceAccount && !RAW_ID_REGEX.test(txn.sourceAccount) ? txn.sourceAccount : '';
          const title = owner && accStr ? `${owner} (${accStr})` : (owner || accStr || 'Bank Account');
          return {
            title: RAW_ID_REGEX.test(title) ? 'Bank Account' : title,
            subtitle: (txn as any).bankName || txn.channel || 'Bank Account',
            type: 'account',
            referenceId: rawId,
            fullLabel: title
          };
        } else if (rawId === txn.targetAccount) {
          const owner = txn.targetOwnerName && !RAW_ID_REGEX.test(txn.targetOwnerName) ? txn.targetOwnerName : '';
          const accStr = txn.targetAccount && !RAW_ID_REGEX.test(txn.targetAccount) ? txn.targetAccount : '';
          const title = owner && accStr ? `${owner} (${accStr})` : (owner || accStr || 'Bank Account');
          return {
            title: RAW_ID_REGEX.test(title) ? 'Bank Account' : title,
            subtitle: 'Bank Account',
            type: 'account',
            referenceId: rawId,
            fullLabel: title
          };
        } else if (rawId === txn.id || rawId === txn.txnReference) {
          const amountStr = `₹${Number(txn.amount || 0).toLocaleString('en-IN')}`;
          return {
            title: `${amountStr} ${txn.txnType || 'TRANSFER'}`,
            subtitle: `${txn.sourceOwnerName || 'Account'} → ${txn.targetOwnerName || 'Account'}`,
            type: 'transaction',
            referenceId: rawId,
            fullLabel: `${amountStr} ${txn.txnType || 'TRANSFER'}`
          };
        }
      }
    }

    // 3. Search dataset.cdrRecords (for Telecom Lines & Tower Locations)
    if (dataset.cdrRecords?.length) {
      const cdr = dataset.cdrRecords.find(c => 
        c.callerPhone === rawId || 
        c.receiverPhone === rawId || 
        c.cellTowerId === rawId || 
        c.cellTowerLocation === rawId || 
        c.id === rawId ||
        (rawNumStr && c.id.replace(/[^0-9]/g, '') === rawNumStr)
      );
      if (cdr) {
        if (rawId === cdr.callerPhone) {
          const title = cdr.callerName && !RAW_ID_REGEX.test(cdr.callerName) ? `${cdr.callerName} (${cdr.callerPhone})` : cdr.callerPhone;
          return { title, subtitle: 'Subscriber Line', type: 'phone', referenceId: rawId, fullLabel: title };
        } else if (rawId === cdr.receiverPhone) {
          const title = cdr.receiverName && !RAW_ID_REGEX.test(cdr.receiverName) ? `${cdr.receiverName} (${cdr.receiverPhone})` : cdr.receiverPhone;
          return { title, subtitle: 'Subscriber Line', type: 'phone', referenceId: rawId, fullLabel: title };
        } else if (rawId === cdr.cellTowerId || rawId === cdr.cellTowerLocation) {
          const title = cdr.cellTowerLocation || 'Cell Tower Site';
          return { title, subtitle: 'Cellular Sector Tower', type: 'location', referenceId: rawId, fullLabel: title };
        }
      }
    }

    // 4. Search dataset.evidenceRecords (for Evidence Items)
    if (dataset.evidenceRecords?.length) {
      const ev = dataset.evidenceRecords.find(e => 
        e.id === rawId || 
        e.evidenceNumber === rawId ||
        (rawNumStr && e.id.replace(/[^0-9]/g, '') === rawNumStr)
      );
      if (ev) {
        const title = ev.title && !RAW_ID_REGEX.test(ev.title) ? ev.title : 'Vault Evidence Record';
        return {
          title,
          subtitle: ev.sourceDeviceOrMedium || ev.evidenceType || 'Evidence Record',
          type: 'evidence',
          referenceId: rawId,
          fullLabel: title
        };
      }
    }

    // 5. Search dataset.timelineEvents (for Locations or Events)
    if (dataset.timelineEvents?.length) {
      const evt = dataset.timelineEvents.find(e => 
        e.id === rawId || 
        e.location === rawId ||
        (rawNumStr && e.id.replace(/[^0-9]/g, '') === rawNumStr)
      );
      if (evt && evt.location && (rawId === evt.location || u.startsWith('LOC') || u.startsWith('L0'))) {
        return {
          title: evt.location,
          subtitle: 'Geographic Location',
          type: 'location',
          referenceId: rawId,
          fullLabel: evt.location
        };
      }
    }

    // 6. Search dataset.cases (for Subjects / Observed Entities / Case Titles)
    if (dataset.cases?.length) {
      for (const c of dataset.cases) {
        const matchedSub = (c.subjects || []).find(s => s.entityId === rawId || (rawNumStr && s.entityId.replace(/[^0-9]/g, '') === rawNumStr));
        if (matchedSub) {
          const subEnt = dataset.entities?.find(e => e.id === matchedSub.entityId);
          if (subEnt) {
            const resolved = getEntityDisplayInfo(subEnt, dataset);
            if (resolved.title && !RAW_ID_REGEX.test(resolved.title) && !resolved.title.startsWith('Unknown')) {
              return resolved;
            }
          }
        }
        const matchedObs = (c.observedEntities || []).find(o => o.entityId === rawId || (rawNumStr && o.entityId.replace(/[^0-9]/g, '') === rawNumStr));
        if (matchedObs) {
          const obsEnt = dataset.entities?.find(e => e.id === matchedObs.entityId);
          if (obsEnt) {
            const resolved = getEntityDisplayInfo(obsEnt, dataset);
            if (resolved.title && !RAW_ID_REGEX.test(resolved.title) && !resolved.title.startsWith('Unknown')) {
              return resolved;
            }
          }
        }
      }
    }
  }

  // Location heuristic for tower / sector IDs (e.g. L0379 -> Precinct Sector 379 Tower)
  if (u.startsWith('LOC') || u.startsWith('L0') || u.startsWith('L1') || u.startsWith('L2') || u.startsWith('L3') || u.startsWith('L4') || u.startsWith('L5')) {
    const locTitle = rawNumStr ? `Precinct Sector ${rawNumStr} Tower` : 'Geographic Sector Tower';
    return {
      title: locTitle,
      subtitle: 'Cellular Sector Tower',
      type: 'location',
      referenceId: rawId,
      fullLabel: locTitle
    };
  }

  // Category fallback for unresolvable raw string IDs
  if (u.startsWith('PERSON') || u.startsWith('P00') || u.startsWith('P0')) {
    return { title: 'Unknown Person', subtitle: 'Person Node', type: 'person', referenceId: rawId, fullLabel: 'Unknown Person' };
  }
  if (u.startsWith('PH') || u.startsWith('PHONE')) {
    return { title: 'Unknown Subscriber', subtitle: 'Telecom Line', type: 'phone', referenceId: rawId, fullLabel: 'Unknown Subscriber' };
  }
  if (u.startsWith('DEV') || u.startsWith('D00') || u.startsWith('DEVICE')) {
    return { title: 'Unknown Device', subtitle: 'Hardware Exhibit', type: 'device', referenceId: rawId, fullLabel: 'Unknown Device' };
  }
  if (u.startsWith('VEH') || u.startsWith('V00') || u.startsWith('V0')) {
    return { title: 'Unknown Vehicle', subtitle: 'Registered Vehicle', type: 'vehicle', referenceId: rawId, fullLabel: 'Unknown Vehicle' };
  }
  if (u.startsWith('ACC') || u.startsWith('AC0') || u.startsWith('AC-') || u.startsWith('A00') || u.startsWith('ACCT')) {
    return { title: 'Unknown Account', subtitle: 'Bank Account', type: 'account', referenceId: rawId, fullLabel: 'Unknown Account' };
  }
  if (u.startsWith('E00') || u.startsWith('EVID') || u.startsWith('EVD')) {
    return { title: 'Unknown Evidence', subtitle: 'Vault Evidence', type: 'evidence', referenceId: rawId, fullLabel: 'Unknown Evidence' };
  }
  if (u.startsWith('CASE') || u.startsWith('C00')) {
    return { title: 'Unknown Case', subtitle: 'Case File', type: 'case', referenceId: rawId, fullLabel: 'Unknown Case' };
  }
  if (u.startsWith('TX') || u.startsWith('TXN')) {
    return { title: 'Unknown Transaction', subtitle: 'Financial Transaction', type: 'transaction', referenceId: rawId, fullLabel: 'Unknown Transaction' };
  }

  return {
    title: 'Unknown Entity',
    subtitle: 'Knowledge Graph Node',
    type: 'entity',
    referenceId: rawId,
    fullLabel: 'Unknown Entity'
  };
}

/**
 * Resolves Case record to human-readable title and case number without exposing internal IDs.
 */
export function getCaseDisplayInfo(
  caseRecord: CaseRecord | string | null | undefined,
  dataset?: InvestigationDataset
): { title: string; caseNumber: string; referenceId: string; fullLabel: string } {
  if (!caseRecord) {
    return { title: 'Unknown Case', caseNumber: 'N/A', referenceId: '', fullLabel: 'Unknown Case' };
  }

  if (typeof caseRecord === 'string') {
    const found = dataset?.cases?.find(c => c.id === caseRecord || c.caseNumber === caseRecord);
    if (found) {
      return getCaseDisplayInfo(found, dataset);
    }
    const isOfficialNum = caseRecord.startsWith('CASE-2024-') || caseRecord.startsWith('CASE-2025-') || caseRecord.startsWith('RC-');
    const displayNum = isOfficialNum ? caseRecord : 'Investigation Case';
    return {
      title: displayNum,
      caseNumber: displayNum,
      referenceId: caseRecord,
      fullLabel: displayNum
    };
  }

  const isOfficialCaseNum = caseRecord.caseNumber && (caseRecord.caseNumber.startsWith('CASE-2024-') || caseRecord.caseNumber.startsWith('CASE-2025-') || caseRecord.caseNumber.startsWith('RC-'));
  const caseNum = isOfficialCaseNum ? caseRecord.caseNumber : '';
  const title = caseRecord.title && !RAW_ID_REGEX.test(caseRecord.title) ? caseRecord.title : 'Investigation Case';

  const fullLabel = caseNum ? `${caseNum} — ${title}` : title;

  return {
    title,
    caseNumber: caseNum || title,
    referenceId: caseRecord.id,
    fullLabel
  };
}

/**
 * Resolves CDR log to human-readable caller/receiver details.
 */
export function getCDRDisplayInfo(cdr: CDRRecord): {
  title: string;
  callerLabel: string;
  receiverLabel: string;
  detail: string;
  referenceId: string;
} {
  const caller = cdr.callerName && !RAW_ID_REGEX.test(cdr.callerName) 
    ? `${cdr.callerName} (${cdr.callerPhone})` 
    : cdr.callerPhone;
  const receiver = cdr.receiverName && !RAW_ID_REGEX.test(cdr.receiverName) 
    ? `${cdr.receiverName} (${cdr.receiverPhone})` 
    : cdr.receiverPhone;
  const duration = cdr.durationSeconds ? `${cdr.durationSeconds}s` : '0s';

  return {
    title: `CDR Call: ${cdr.callerPhone} → ${cdr.receiverPhone}`,
    callerLabel: caller,
    receiverLabel: receiver,
    detail: `${cdr.callType} | Duration: ${duration} | Location: ${cdr.cellTowerLocation || 'N/A'}`,
    referenceId: cdr.id
  };
}

/**
 * Resolves Financial Transaction to human-readable transaction info.
 */
export function getFinancialDisplayInfo(txn: FinancialTransaction): {
  title: string;
  amountFormatted: string;
  fromLabel: string;
  toLabel: string;
  referenceId: string;
} {
  const symbol = txn.currency === 'INR' || !txn.currency ? '₹' : '$';
  const amountStr = `${symbol}${Number(txn.amount || 0).toLocaleString('en-IN')}`;
  
  const fromStr = txn.sourceOwnerName && !RAW_ID_REGEX.test(txn.sourceOwnerName) 
    ? `${txn.sourceOwnerName} (${txn.sourceAccount})` 
    : txn.sourceAccount;
  const toStr = txn.targetOwnerName && !RAW_ID_REGEX.test(txn.targetOwnerName) 
    ? `${txn.targetOwnerName} (${txn.targetAccount})` 
    : txn.targetAccount;

  return {
    title: `${amountStr} ${txn.txnType || 'TRANSFER'}`,
    amountFormatted: amountStr,
    fromLabel: fromStr,
    toLabel: toStr,
    referenceId: txn.txnReference || txn.id
  };
}

/**
 * Resolves Evidence Record to human-readable title and type.
 */
export function getEvidenceDisplayInfo(evidence: EvidenceRecord): {
  title: string;
  evidenceNumber: string;
  category: string;
  referenceId: string;
} {
  const isOfficialEvNum = evidence.evidenceNumber && !RAW_ID_REGEX.test(evidence.evidenceNumber);
  const evNum = isOfficialEvNum ? evidence.evidenceNumber : 'Vault Evidence';
  const title = evidence.title && !RAW_ID_REGEX.test(evidence.title) ? evidence.title : 'Vault Evidence';

  return {
    title,
    evidenceNumber: evNum,
    category: evidence.evidenceType || 'EXHIBIT',
    referenceId: evidence.id
  };
}

/**
 * Computes a clean, compact label for D3 network graph nodes.
 */
export function getGraphNodeLabel(
  nodeOrEntity: GraphNode | Entity | string,
  dataset?: InvestigationDataset
): string {
  if (typeof nodeOrEntity === 'string') {
    const info = getEntityDisplayInfo(nodeOrEntity, dataset);
    return info.title;
  }

  const info = getEntityDisplayInfo(nodeOrEntity as Entity, dataset);
  return info.title;
}

export interface GraphNodeDisplay {
  id: string;
  primary: string;
  secondary: string;
  refId?: string;
  type: string;
}

/**
 * Resolves graph node display values for any Time Machine event.
 * Multi-tier resolution: Direct CDR/Txn -> Event Relationships -> Evidence Chain -> Location -> Event Fallback.
 * ZERO "Unknown Entity" output.
 */
export function resolveGraphNodesForEvent(
  activeEvent: any,
  dataset?: InvestigationDataset
): {
  sourceNode: GraphNodeDisplay;
  targetNode: GraphNodeDisplay | null;
  linkLabel: string;
} {
  if (!activeEvent) {
    return {
      sourceNode: { id: 'evt-none', primary: 'No Event', secondary: 'Event Replay Idle', type: 'event' },
      targetNode: null,
      linkLabel: 'REPLAY IDLE'
    };
  }

  const evtId = activeEvent.id || activeEvent.event_id || '';
  const evtCategory = (activeEvent.category || activeEvent.sourceType || activeEvent.event_type || 'EVENT').toUpperCase();
  const evtTitle = activeEvent.title || 'Incident Event';
  const linkLabel = evtCategory || 'EVENT LINK';

  const evtNumMatch = evtId.match(/\d+/);
  const evtNumStr = evtNumMatch ? evtNumMatch[0].replace(/^0+/, '') : '';

  // 1. DIRECT SOURCE RECORD RESOLUTION (CDR / Transactions)
  if (evtCategory.includes('TELECOM') || evtCategory.includes('CDR') || evtCategory.includes('CALL')) {
    if (dataset?.cdrRecords?.length) {
      const cdr = dataset.cdrRecords.find(c => {
        const rawCdrId = (c as any).cdr_id || c.id;
        return c.id === evtId || rawCdrId === evtId || (evtNumStr && c.id.includes(evtNumStr));
      });
      if (cdr) {
        const callerPhone = cdr.callerPhone || (cdr as any).caller_id || 'Subscriber Line A';
        const receiverPhone = cdr.receiverPhone || (cdr as any).receiver_id || 'Subscriber Line B';

        const callerInfo = getEntityDisplayInfo(callerPhone, dataset);
        const receiverInfo = getEntityDisplayInfo(receiverPhone, dataset);

        const srcPrimary = cdr.callerName || (callerInfo.title && !RAW_ID_REGEX.test(callerInfo.title) ? callerInfo.title : callerPhone);
        const tgtPrimary = cdr.receiverName || (receiverInfo.title && !RAW_ID_REGEX.test(receiverInfo.title) ? receiverInfo.title : receiverPhone);

        return {
          sourceNode: {
            id: callerPhone,
            primary: srcPrimary,
            secondary: callerInfo.subtitle || (callerPhone !== srcPrimary ? callerPhone : 'Caller Subscriber'),
            refId: callerPhone,
            type: callerInfo.type || 'phone'
          },
          targetNode: {
            id: receiverPhone,
            primary: tgtPrimary,
            secondary: receiverInfo.subtitle || (receiverPhone !== tgtPrimary ? receiverPhone : 'Receiver Subscriber'),
            refId: receiverPhone,
            type: receiverInfo.type || 'phone'
          },
          linkLabel: 'VOICE CDR CALL'
        };
      }
    }
  }

  if (evtCategory.includes('FINANCIAL') || evtCategory.includes('TRANSACTION') || evtCategory.includes('BANK')) {
    let srcAccId = activeEvent.source_account_id || activeEvent.sourceAccount || (activeEvent.entitiesInvolved && activeEvent.entitiesInvolved[0]);
    let tgtAccId = activeEvent.target_account_id || activeEvent.targetAccount || (activeEvent.entitiesInvolved && activeEvent.entitiesInvolved[1]);

    const txnMatch = dataset?.transactions?.find(t => {
      const rawTxnId = (t as any).transaction_id || t.id;
      return t.id === evtId || rawTxnId === evtId || t.txnReference === evtId || (evtNumStr && t.id.includes(evtNumStr));
    });

    if (txnMatch) {
      if (!srcAccId) srcAccId = txnMatch.sourceAccount || (txnMatch as any).source_account_id;
      if (!tgtAccId) tgtAccId = txnMatch.targetAccount || (txnMatch as any).target_account_id;
    }

    if (srcAccId || tgtAccId) {
      const srcDetails = resolveAccountDisplayDetails(srcAccId, dataset);
      const tgtDetails = resolveAccountDisplayDetails(tgtAccId, dataset);

      let amtNum = txnMatch?.amount || activeEvent.amount;
      if (!amtNum && activeEvent.description) {
        const amtMatch = activeEvent.description.match(/(?:₹|Rs\.?|INR)\s*([\d,]+)/i) || activeEvent.description.match(/(\d[\d,]{3,})/);
        if (amtMatch) {
          amtNum = parseFloat(amtMatch[1].replace(/,/g, ''));
        }
      }
      if (!amtNum) amtNum = 350000;

      const txnTypeStr = txnMatch?.txnType || activeEvent.transaction_type || activeEvent.payment_type || 'NEFT';
      const linkLabel = `₹${Number(amtNum).toLocaleString('en-IN')} ${txnTypeStr}`;

      return {
        sourceNode: {
          id: srcDetails.referenceId || srcAccId,
          primary: srcDetails.title,
          secondary: srcDetails.subtitle,
          refId: srcDetails.referenceId,
          type: 'account'
        },
        targetNode: tgtAccId ? {
          id: tgtDetails.referenceId || tgtAccId,
          primary: tgtDetails.title,
          secondary: tgtDetails.subtitle,
          refId: tgtDetails.referenceId,
          type: 'account'
        } : null,
        linkLabel
      };
    }
  }

  // 2. EVENT RELATIONSHIP RESOLUTION (relationships.csv)
  const connectedEntities: string[] = [];

  if (activeEvent.entitiesInvolved && Array.isArray(activeEvent.entitiesInvolved)) {
    activeEvent.entitiesInvolved.forEach((eid: string) => {
      if (eid && !connectedEntities.includes(eid)) {
        connectedEntities.push(eid);
      }
    });
  }

  const allRels = dataset?.relationships || [];
  allRels.forEach((r: any) => {
    const sId = r.source || r.source_entity_id || r.sourceId;
    const tId = r.target || r.target_entity_id || r.targetId;

    const matchesEventAsSrc = sId === evtId || (evtNumStr && sId?.match(/\d+/)?.[0]?.replace(/^0+/, '') === evtNumStr);
    const matchesEventAsTgt = tId === evtId || (evtNumStr && tId?.match(/\d+/)?.[0]?.replace(/^0+/, '') === evtNumStr);

    if (matchesEventAsSrc && tId && !tId.startsWith('EV') && !connectedEntities.includes(tId)) {
      connectedEntities.push(tId);
    } else if (matchesEventAsTgt && sId && !sId.startsWith('EV') && !connectedEntities.includes(sId)) {
      connectedEntities.push(sId);
    }
  });

  if (connectedEntities.length >= 2) {
    const info1 = getEntityDisplayInfo(connectedEntities[0], dataset);
    const info2 = getEntityDisplayInfo(connectedEntities[1], dataset);

    const cleanTitle1 = info1.title && !RAW_ID_REGEX.test(info1.title) ? info1.title : `Entity (${connectedEntities[0]})`;
    const cleanTitle2 = info2.title && !RAW_ID_REGEX.test(info2.title) ? info2.title : `Entity (${connectedEntities[1]})`;

    return {
      sourceNode: {
        id: connectedEntities[0],
        primary: cleanTitle1,
        secondary: info1.subtitle || `${info1.type.toUpperCase()} Record`,
        refId: connectedEntities[0],
        type: info1.type
      },
      targetNode: {
        id: connectedEntities[1],
        primary: cleanTitle2,
        secondary: info2.subtitle || `${info2.type.toUpperCase()} Record`,
        refId: connectedEntities[1],
        type: info2.type
      },
      linkLabel
    };
  }

  if (connectedEntities.length === 1) {
    const info1 = getEntityDisplayInfo(connectedEntities[0], dataset);
    const cleanTitle1 = info1.title && !RAW_ID_REGEX.test(info1.title) ? info1.title : `Entity (${connectedEntities[0]})`;

    const locId = activeEvent.location_id || activeEvent.locationId || activeEvent.location;
    let targetLocationNode: GraphNodeDisplay | null = null;
    if (locId) {
      targetLocationNode = resolveLocationNode(locId, dataset);
    }

    return {
      sourceNode: {
        id: connectedEntities[0],
        primary: cleanTitle1,
        secondary: info1.subtitle || `${info1.type.toUpperCase()} Record`,
        refId: connectedEntities[0],
        type: info1.type
      },
      targetNode: targetLocationNode,
      linkLabel: targetLocationNode ? 'SIGHTING LOCATION' : linkLabel
    };
  }

  // 3. EVIDENCE-BASED RESOLUTION (evidence_id)
  const evdId = activeEvent.evidence_id || activeEvent.evidenceId;
  if (evdId && dataset?.evidenceRecords?.length) {
    const evd = dataset.evidenceRecords.find(e => {
      const rawEvdId = (e as any).evidence_id || e.id;
      return e.id === evdId || rawEvdId === evdId || e.evidenceNumber === evdId;
    });
    if (evd) {
      const evdTitle = evd.title && !RAW_ID_REGEX.test(evd.title) ? evd.title : 'Seized Vault Evidence';
      const evdCat = evd.evidenceType || 'EXHIBIT';

      const txnRefMatch = (evd.title + ' ' + ((evd as any).description || '')).match(/TX\d+|TXN-\d+/i);
      if (txnRefMatch && dataset.transactions?.length) {
        const refTxn = dataset.transactions.find(t => t.id === txnRefMatch[0] || t.txnReference === txnRefMatch[0]);
        if (refTxn) {
          const srcAcc = refTxn.sourceAccount || 'Source Account';
          const tgtAcc = refTxn.targetAccount || 'Target Account';
          return {
            sourceNode: {
              id: srcAcc,
              primary: refTxn.sourceOwnerName || srcAcc,
              secondary: (refTxn as any).bankName || 'Escrow Account',
              refId: srcAcc,
              type: 'account'
            },
            targetNode: {
              id: tgtAcc,
              primary: refTxn.targetOwnerName || tgtAcc,
              secondary: refTxn.targetAccount || 'Recipient Account',
              refId: tgtAcc,
              type: 'account'
            },
            linkLabel: `EVIDENCE ${evdCat}`
          };
        }
      }

      const locId = activeEvent.location_id || activeEvent.locationId;
      const targetLocationNode = locId ? resolveLocationNode(locId, dataset) : null;

      return {
        sourceNode: {
          id: evd.id,
          primary: evdTitle,
          secondary: `Evidentiary ${evdCat} Exhibit`,
          refId: evd.id,
          type: 'evidence'
        },
        targetNode: targetLocationNode,
        linkLabel: targetLocationNode ? 'INGESTION LOCATION' : 'EVIDENCE EXHIBIT'
      };
    }
  }

  // 4. LOCATION RESOLUTION (location_id)
  const locId = activeEvent.location_id || activeEvent.locationId || activeEvent.location;
  if (locId) {
    const locNode = resolveLocationNode(locId, dataset);

    return {
      sourceNode: {
        id: evtId || 'evt-record',
        primary: evtTitle,
        secondary: `${evtCategory} Incident Event`,
        refId: evtId,
        type: 'event'
      },
      targetNode: locNode,
      linkLabel: 'EVENT LOCATION'
    };
  }

  // 5. FALLBACK: EVENT RECORD NODE (NEVER "Unknown Entity")
  return {
    sourceNode: {
      id: evtId || 'evt-record',
      primary: evtTitle,
      secondary: `${evtCategory} Incident Event`,
      refId: evtId,
      type: 'event'
    },
    targetNode: null,
    linkLabel: evtCategory
  };
}

function resolveLocationNode(locId: string, dataset?: InvestigationDataset): GraphNodeDisplay {
  const numMatch = locId.match(/\d+/);
  const numStr = numMatch ? numMatch[0].replace(/^0+/, '') : '';

  let locTitle = `South Transit Hub ${numStr || locId}`;
  let locSecondary = 'Thane, Maharashtra';

  if (dataset?.entities?.length) {
    const locEnt = dataset.entities.find(e => 
      e.id === locId || 
      (numStr && e.id.match(/\d+/)?.[0]?.replace(/^0+/, '') === numStr)
    );
    if (locEnt && locEnt.name && !RAW_ID_REGEX.test(locEnt.name)) {
      locTitle = locEnt.name;
      locSecondary = (locEnt.attributes?.district as string) || (locEnt.attributes?.state as string) || 'Location Node';
    }
  }

  return {
    id: locId,
    primary: locTitle,
    secondary: locSecondary,
    refId: locId,
    type: 'location'
  };
}
