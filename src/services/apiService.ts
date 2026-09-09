import { Entity, CaseRecord, AnomalySignal } from '../types/investigation';

const API_BASE = (((import.meta as any).env?.VITE_API_BASE_URL) || 'http://localhost:8000/api').replace(/\/$/, '');

const MOCK_SEED_USERS = [
  {
    investigator_id: 'INV-LEAD-001',
    email: 'miller@sherlock.gov',
    password: 'sherlock2026',
    full_name: 'Sgt. Miller',
    badge_number: 'Badge #4412',
    role: 'Lead Investigator',
    authorized_cases: ['CASE-CYBER-8841', 'CASE-NARCO-9921', 'CASE-000001', 'CASE-000002', 'C0001', 'C0002']
  },
  {
    investigator_id: 'INV-SPEC-001',
    email: 'spec.sherlock@sherlock.gov',
    password: 'sherlock2026',
    full_name: 'Analyst Sherlock',
    badge_number: 'Badge #8821',
    role: 'Investigation Specialist',
    authorized_cases: ['CASE-CYBER-8841', 'CASE-000001', 'C0001']
  },
  {
    investigator_id: 'INV-FIELD-001',
    email: 'agent.watson@sherlock.gov',
    password: 'sherlock2026',
    full_name: 'Officer Watson',
    badge_number: 'Badge #1002',
    role: 'Field Agent',
    authorized_cases: ['CASE-CYBER-8841', 'C0001']
  },
  {
    investigator_id: 'ID-0000-00',
    email: 'investigator@agency.gov',
    password: 'password123',
    full_name: 'Agent Watson',
    badge_number: 'Badge #0000',
    role: 'Field Agent',
    authorized_cases: ['CASE-CYBER-8841', 'C0001']
  }
];

export async function loginApi(credentials: { investigatorId?: string; email?: string; password?: string; rememberDevice?: boolean }) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        investigator_id: credentials.investigatorId,
        email: credentials.email,
        password: credentials.password,
        remember_device: credentials.rememberDevice
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Invalid credentials');
    }
    return data;
  } catch (err: any) {
    if (err.message && (err.message.includes('Invalid credentials') || err.message.includes('required'))) {
      throw err;
    }

    const idInput = (credentials.investigatorId || '').trim().toLowerCase();
    const emailInput = (credentials.email || '').trim().toLowerCase();
    const pwdInput = (credentials.password || '').trim();

    const matchedUser = MOCK_SEED_USERS.find(user => {
      const matchesId = idInput && user.investigator_id.toLowerCase() === idInput;
      const matchesEmail = emailInput && user.email.toLowerCase() === emailInput;
      return (matchesId || matchesEmail) && user.password === pwdInput;
    });

    if (matchedUser) {
      return {
        token: `sherlock_session_offline_${Date.now()}`,
        user: {
          investigator_id: matchedUser.investigator_id,
          email: matchedUser.email,
          full_name: matchedUser.full_name,
          badge_number: matchedUser.badge_number,
          role: matchedUser.role
        },
        message: 'Authentication successful (Offline Mode).'
      };
    }

    throw new Error(err.message || 'Invalid credentials');
  }
}

export async function verifySessionApi(token: string) {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (err) {
    if (token && token.startsWith('sherlock_session_offline_')) {
      return MOCK_SEED_USERS[0];
    }
    return null;
  }
}

export async function logoutApi(token?: string) {
  try {
    if (token) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    }
  } catch (err) {
    console.warn('Logout API warning:', err);
  }
}

export async function fetchHealthStatus() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`Health status check failed: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend API connection offline:', err);
    return null;
  }
}

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem('sherlock_auth_token');
  if (token) {
    extraHeaders['Authorization'] = `Bearer ${token}`;
  }
  return extraHeaders;
}

export async function fetchAnalyticsSummary(caseId?: string, signal?: AbortSignal) {
  try {
    let url = `${API_BASE}/analytics/summary`;
    if (caseId) url += `?case_id=${encodeURIComponent(caseId)}`;
    const res = await fetch(url, { headers: getAuthHeaders(), signal });
    if (!res.ok) throw new Error(`Analytics fetch failed: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    if (err?.name === 'AbortError') return null;
    console.error('Failed to fetch real analytics summary:', err);
    return null;
  }
}

export async function fetchRealCases(limit = 5000, search?: string, signal?: AbortSignal): Promise<CaseRecord[]> {
  try {
    let url = `${API_BASE}/cases?limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const res = await fetch(url, { headers: getAuthHeaders(), signal });
    if (!res.ok) throw new Error(`Cases fetch failed: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') return [];
    console.error('Failed to fetch real cases from backend:', err);
    return [];
  }
}

export async function fetchCaseById(caseId: string, signal?: AbortSignal): Promise<CaseRecord | null> {
  try {
    const res = await fetch(`${API_BASE}/cases/${caseId}`, { headers: getAuthHeaders(), signal });
    if (!res.ok) throw new Error(`Case fetch failed: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    console.error(`Failed to fetch case ${caseId}:`, err);
    return null;
  }
}

export async function fetchCaseWorkspace(caseId: string, signal?: AbortSignal) {
  try {
    const res = await fetch(`${API_BASE}/cases/${caseId}/workspace`, { headers: getAuthHeaders(), signal });
    if (!res.ok) throw new Error(`Case workspace fetch failed: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    console.error(`Failed to fetch workspace for case ${caseId}:`, err);
    return null;
  }
}

export async function fetchRealEntities(limit = 2000, type?: string, q?: string, risk?: string, caseId?: string, signal?: AbortSignal): Promise<Entity[]> {
  try {
    let url = `${API_BASE}/entities?limit=${limit}`;
    if (type && type !== 'ALL') url += `&type=${encodeURIComponent(type)}`;
    if (q && q.trim()) url += `&q=${encodeURIComponent(q.trim())}`;
    if (risk && risk !== 'ALL') url += `&risk=${encodeURIComponent(risk)}`;
    if (caseId) url += `&case_id=${encodeURIComponent(caseId)}`;
    const res = await fetch(url, { headers: getAuthHeaders(), signal });
    if (!res.ok) throw new Error(`Entities fetch failed: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') return [];
    console.error('Failed to fetch real entities from backend:', err);
    return [];
  }
}

export async function fetchEntityDossier(entityId: string, caseId?: string, signal?: AbortSignal) {
  try {
    let url = `${API_BASE}/entities/${entityId}/dossier`;
    if (caseId) url += `?case_id=${encodeURIComponent(caseId)}`;
    const res = await fetch(url, { signal });
    if (res.ok) return await res.json();
    throw new Error(`Entity dossier fetch failed: ${res.statusText}`);
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    console.error(`Failed to fetch dossier for entity ${entityId}:`, err);
    return null;
  }
}

export async function fetchEvidenceList(limit = 100, caseId?: string, evidenceType?: string, signal?: AbortSignal) {
  try {
    let url = `${API_BASE}/evidence?limit=${limit}`;
    if (caseId) url += `&case_id=${encodeURIComponent(caseId)}`;
    if (evidenceType && evidenceType !== 'ALL') url += `&evidence_type=${encodeURIComponent(evidenceType)}`;
    const res = await fetch(url, { headers: getAuthHeaders(), signal });
    if (!res.ok) throw new Error(`Evidence fetch failed: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') return [];
    console.error('Failed to fetch evidence:', err);
    return [];
  }
}

export async function fetchGraphTopology(
  limit = 150, 
  focusId?: string, 
  caseId?: string, 
  relationType?: string, 
  hops = 2,
  minConfidence = 0,
  startDate?: string,
  endDate?: string,
  signal?: AbortSignal
) {
  try {
    let url = `${API_BASE}/graph/topology?limit=${limit}`;
    if (focusId) url += `&focus_id=${encodeURIComponent(focusId)}`;
    if (caseId) url += `&case_id=${encodeURIComponent(caseId)}`;
    if (relationType && relationType !== 'ALL') url += `&type=${encodeURIComponent(relationType)}`;
    if (hops) url += `&hops=${hops}`;
    if (minConfidence) url += `&min_confidence=${minConfidence}`;
    if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Graph topology fetch failed: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') return { nodes: [], edges: [], totalNodes: 0, totalEdges: 0 };
    console.error('Failed to fetch graph topology:', err);
    return { nodes: [], edges: [], totalNodes: 0, totalEdges: 0 };
  }
}

export async function fetchCaseRelatedPersons(caseId?: string, focusId?: string, signal?: AbortSignal): Promise<Array<{ id: string; person_id: string; name: string; displayName: string; role?: string }>> {
  try {
    let url = `${API_BASE}/graph/persons`;
    const params = new URLSearchParams();
    if (caseId) params.append('case_id', caseId);
    if (focusId) params.append('focus_id', focusId);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Fetch case persons failed: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') return [];
    console.error('Failed to fetch case related persons:', err);
    return [];
  }
}

export async function traceGraphPath(sourcePersonId: string, targetPersonId: string, caseId?: string, signal?: AbortSignal) {
  try {
    const res = await fetch(`${API_BASE}/graph/trace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_person_id: sourcePersonId,
        target_person_id: targetPersonId,
        case_id: caseId
      }),
      signal
    });
    if (!res.ok) throw new Error(`Graph trace failed: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    console.error('Failed to trace graph path:', err);
    return { found: false, message: 'No verified relationship path found for this case.', pathNodeIds: [], pathNodes: [], pathLinks: [] };
  }
}

export async function fetchTimelineEvents(limit = 100, caseId?: string, entityId?: string, signal?: AbortSignal) {
  try {
    let url = `${API_BASE}/events?limit=${limit}`;
    if (caseId) url += `&case_id=${encodeURIComponent(caseId)}`;
    if (entityId) url += `&entity_id=${encodeURIComponent(entityId)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Timeline events fetch failed: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') return [];
    console.error('Failed to fetch timeline events:', err);
    return [];
  }
}

export async function fetchCDRs(limit = 100, phoneId?: string, caseId?: string, signal?: AbortSignal) {
  try {
    let url = `${API_BASE}/cdrs?limit=${limit}`;
    if (phoneId) url += `&phone_id=${encodeURIComponent(phoneId)}`;
    if (caseId) url += `&case_id=${encodeURIComponent(caseId)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`CDRs fetch failed: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') return [];
    console.error('Failed to fetch CDRs:', err);
    return [];
  }
}

export async function fetchTransactions(limit = 100, accountId?: string, caseId?: string, signal?: AbortSignal) {
  try {
    let url = `${API_BASE}/transactions?limit=${limit}`;
    if (accountId) url += `&account_id=${encodeURIComponent(accountId)}`;
    if (caseId) url += `&case_id=${encodeURIComponent(caseId)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Transactions fetch failed: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') return [];
    console.error('Failed to fetch transactions:', err);
    return [];
  }
}

export async function performGlobalSearch(q: string, signal?: AbortSignal) {
  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`, { signal });
    if (!res.ok) throw new Error(`Global search failed: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') return { query: q, cases: [], persons: [], evidence: [], totalMatches: 0 };
    console.error('Global search error:', err);
    return { query: q, cases: [], persons: [], evidence: [], totalMatches: 0 };
  }
}

export async function createEvidenceApi(evidenceData: {
  description: string;
  evidence_type?: string;
  case_id?: string;
  person_id?: string;
  source?: string;
}) {
  try {
    const res = await fetch(`${API_BASE}/evidence`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(evidenceData)
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error((errJson && (errJson.detail || errJson.message)) || `Create evidence failed: ${res.statusText}`);
    }
    return await res.json();
  } catch (err: any) {
    console.error('Error creating evidence:', err);
    throw new Error(err.message || 'Failed to create evidence');
  }
}

export async function fetchAnomalies(limit = 200, caseId?: string, category?: string, severity?: string, signal?: AbortSignal): Promise<AnomalySignal[]> {
  try {
    let url = `${API_BASE}/analytics/anomalies?limit=${limit}`;
    if (caseId) url += `&case_id=${encodeURIComponent(caseId)}`;
    if (category && category !== 'ALL') url += `&category=${encodeURIComponent(category)}`;
    if (severity && severity !== 'ALL') url += `&severity=${encodeURIComponent(severity)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Anomalies fetch failed: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') return [];
    console.error('Failed to fetch anomalies from backend:', err);
    return [];
  }
}

export async function fetchInvestigationStory(caseId: string, signal?: AbortSignal) {
  try {
    const res = await fetch(`${API_BASE}/cases/${encodeURIComponent(caseId)}/investigation-story`, { signal });
    if (!res.ok) throw new Error(`Fetch story failed: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    console.error('Failed to fetch investigation story:', err);
    throw err;
  }
}

export async function generateInvestigationStory(caseId: string) {
  try {
    const res = await fetch(`${API_BASE}/cases/${encodeURIComponent(caseId)}/investigation-story/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generated_by: 'Lead Investigator' })
    });
    if (!res.ok) throw new Error(`Generate story failed: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    console.error('Failed to generate investigation story:', err);
    throw err;
  }
}

export async function fetchBSACertificate(evidenceId: string, signal?: AbortSignal) {
  try {
    const res = await fetch(`${API_BASE}/evidence/${encodeURIComponent(evidenceId)}/bsa-certificate`, { signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    console.error('Failed to fetch BSA certificate:', err);
    return null;
  }
}

export async function generateBSACertificate(evidenceId: string, officerInfo?: any) {
  try {
    const token = localStorage.getItem('sherlock_auth_token') || sessionStorage.getItem('sherlock_auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/evidence/${encodeURIComponent(evidenceId)}/bsa-certificate/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(officerInfo || {})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `Certificate generation failed: ${res.statusText}`);
    return data;
  } catch (err: any) {
    console.error('Failed to generate BSA Certificate:', err);
    throw err;
  }
}

export function getBSACertificateDownloadUrl(evidenceId: string): string {
  return `${API_BASE}/evidence/${encodeURIComponent(evidenceId)}/bsa-certificate/download`;
}

export async function exportCaseEvidencePdfApi(caseId: string) {
  try {
    const token = localStorage.getItem('sherlock_auth_token') || sessionStorage.getItem('sherlock_auth_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/evidence/export-pdf?case_id=${encodeURIComponent(caseId)}`, {
      headers
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Export failed with status ${res.status}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RAKSHAK_Evidence_Export_${caseId}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err: any) {
    console.error('Failed to export case evidence PDF:', err);
    throw err;
  }
}
