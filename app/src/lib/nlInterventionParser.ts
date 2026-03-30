/**
 * Natural Language Intervention Parser
 * Takes user's free-text description of an intervention and structures it
 * into our Intervention data model using Groq LLM.
 *
 * Handles complex prompts like:
 * - "Build a community wellness center with a spa, gym, nutrition counseling, childcare wing, and free health screenings"
 * - "I want a 100-acre park with walking trails, a farmers market, and 3 new clinics with mental health services"
 * - "Comprehensive investment: subsidize insurance for 20% of uninsured, open 2 grocery stores, hire 15 doctors"
 */

import type { Intervention } from './scoring';
import { DEFAULT_INTERVENTION } from './scoring';

interface ParsedIntervention {
  intervention: Intervention;
  summary: string;
  confidence: number;
  reasoning: string;
}

const SYSTEM_PROMPT = `You are an expert urban policy analyst helping design health equity interventions for Jacksonville, FL.

The user will describe an intervention in natural language — it may be simple or very complex. Your job is to intelligently map ANY description to our resource allocation model.

Our intervention fields (all are numbers, use your judgment to quantify):
- physicians: Primary care physicians to add (0-20). Map: "clinic" → 5, "hospital wing" → 12, "health screenings" → 3, "doctors" → exact number
- mentalHealthProviders: Mental health providers (0-15). Map: "counseling" → 3, "therapy center" → 5, "wellness center" → 4, "spa/meditation" → 2
- groceryStores: Grocery stores or food sources (0-5). Map: "food bank" → 1, "farmers market" → 1, "nutrition program" → 1, "co-op" → 1
- parkAcres: Park/green space acres (0-200). Map: "park" → 50, "trails" → 30, "playground" → 5, "community garden" → 10, "gym/fitness" → 5, "recreation center" → 10
- childCareCenters: Child care centers (0-10). Map: "daycare" → 2, "after-school" → 2, "childcare wing" → 1, "preschool" → 1
- insuranceSubsidyPct: Insurance subsidy % of uninsured (0-30). Map: "free healthcare" → 25, "subsidized" → 15, "insurance help" → 10

IMPORTANT MAPPING RULES:
- A "community center" with fitness = parkAcres:10 + mentalHealthProviders:2
- A "wellness center" = physicians:3 + mentalHealthProviders:4 + parkAcres:5
- A "spa/gym" = parkAcres:10 (recreation counts as green space/fitness infrastructure)
- "Free" anything health-related = insuranceSubsidyPct:10-20
- "Nutrition workshops/classes" = groceryStores:1 (food access program)
- If the user describes a BUILDING, infer what services it would contain
- Be generous — round UP, not down. This is for community impact modeling.

Respond ONLY in valid JSON:
{"intervention":{"physicians":N,"mentalHealthProviders":N,"groceryStores":N,"parkAcres":N,"childCareCenters":N,"insuranceSubsidyPct":N},"summary":"1-sentence plain English summary","confidence":0.0-1.0,"reasoning":"How you mapped each part of the description"}`;

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';

export async function parseNaturalLanguageIntervention(
  userPrompt: string,
  zipCode: string,
): Promise<ParsedIntervention> {
  // Always try LLM first
  if (GROQ_API_KEY) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `ZIP Code: ${zipCode}\nPopulation: ~30,000\n\nIntervention: ${userPrompt}` },
          ],
          temperature: 0.2,
          max_tokens: 400,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim() || '';
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}') + 1;

        if (start >= 0 && end > start) {
          const parsed = JSON.parse(text.substring(start, end));
          return {
            intervention: clampIntervention(parsed.intervention || {}),
            summary: parsed.summary || 'Intervention parsed from description',
            confidence: parsed.confidence || 0.8,
            reasoning: parsed.reasoning || 'LLM-parsed',
          };
        }
      }
    } catch (e) {
      console.warn('LLM parse failed, using enhanced rule-based fallback:', e);
    }
  }

  return ruleBasedParse(userPrompt);
}

function clampIntervention(raw: Partial<Intervention>): Intervention {
  return {
    physicians: Math.min(20, Math.max(0, Math.round(raw.physicians || 0))),
    mentalHealthProviders: Math.min(15, Math.max(0, Math.round(raw.mentalHealthProviders || 0))),
    groceryStores: Math.min(5, Math.max(0, Math.round(raw.groceryStores || 0))),
    parkAcres: Math.min(200, Math.max(0, Math.round(raw.parkAcres || 0))),
    childCareCenters: Math.min(10, Math.max(0, Math.round(raw.childCareCenters || 0))),
    insuranceSubsidyPct: Math.min(30, Math.max(0, Math.round(raw.insuranceSubsidyPct || 0))),
  };
}

function ruleBasedParse(text: string): ParsedIntervention {
  const lower = text.toLowerCase();
  const intervention = { ...DEFAULT_INTERVENTION };
  const parts: string[] = [];

  // Helper: extract number before a keyword
  const numBefore = (pattern: RegExp): number | null => {
    const m = lower.match(pattern);
    return m ? parseInt(m[1]) : null;
  };

  // ─── Physicians / clinic / health center / hospital ───
  if (/clinic|health center|hospital|doctor|physician|primary care|medical|health screening|urgent care|check-?up/i.test(lower)) {
    const n = numBefore(/(\d+)\s*(doctor|physician|provider|clinic)/);
    if (n) intervention.physicians = Math.min(20, n);
    else if (/hospital|medical center/i.test(lower)) intervention.physicians = 12;
    else if (/clinic|health center|urgent care/i.test(lower)) intervention.physicians = 5;
    else if (/screening|check-?up/i.test(lower)) intervention.physicians = 3;
    else intervention.physicians = 5;
    parts.push(`${intervention.physicians} physicians`);
  }

  // ─── Mental health / counseling / wellness / therapy / spa ───
  if (/mental health|counsel|therapist|psychiatr|psycholog|wellness|meditation|yoga|spa|stress|support group/i.test(lower)) {
    const n = numBefore(/(\d+)\s*(counselor|therapist|mental|provider)/);
    if (n) intervention.mentalHealthProviders = Math.min(15, n);
    else if (/wellness center|therapy center/i.test(lower)) intervention.mentalHealthProviders = 5;
    else if (/spa|meditation|yoga/i.test(lower)) intervention.mentalHealthProviders = 3;
    else intervention.mentalHealthProviders = 3;
    parts.push(`${intervention.mentalHealthProviders} MH providers`);
  }

  // ─── Food / grocery / nutrition ───
  if (/grocery|food bank|food pantry|supermarket|co-?op|fresh food|farmer|nutrition|meal|cooking class/i.test(lower)) {
    const n = numBefore(/(\d+)\s*(grocery|food|store|market)/);
    intervention.groceryStores = n ? Math.min(5, n) : (/farmer|cooking|nutrition/i.test(lower) ? 1 : 1);
    parts.push(`${intervention.groceryStores} food access`);
  }

  // ─── Parks / green space / gym / fitness / recreation / trails ───
  if (/park|green space|trail|recreation|playground|garden|outdoor|gym|fitness|exercise|sports|basketball|soccer|splash|pool|walking/i.test(lower)) {
    const n = numBefore(/(\d+)\s*-?\s*acre/);
    if (n) intervention.parkAcres = Math.min(200, n);
    else if (/gym|fitness|recreation center|pool/i.test(lower)) intervention.parkAcres = 15;
    else if (/trail|walking/i.test(lower)) intervention.parkAcres = 30;
    else if (/garden/i.test(lower)) intervention.parkAcres = 10;
    else intervention.parkAcres = 50;
    parts.push(`${intervention.parkAcres} acres recreation`);
  }

  // ─── Childcare ───
  if (/child\s*care|daycare|day care|after.?school|preschool|childcare wing|kids|youth program/i.test(lower)) {
    const n = numBefore(/(\d+)\s*(child|day\s?care|center|preschool)/);
    intervention.childCareCenters = n ? Math.min(10, n) : 2;
    parts.push(`${intervention.childCareCenters} childcare`);
  }

  // ─── Insurance / subsidy / free healthcare ───
  if (/insurance|subsid|medicaid|coverage|uninsured|free\s*(health|care|medical|service)/i.test(lower)) {
    const n = numBefore(/(\d+)\s*%/);
    if (n) intervention.insuranceSubsidyPct = Math.min(30, n);
    else if (/free\s*(health|care|medical|service)/i.test(lower)) intervention.insuranceSubsidyPct = 20;
    else intervention.insuranceSubsidyPct = 10;
    parts.push(`${intervention.insuranceSubsidyPct}% insurance subsidy`);
  }

  // ─── Composite concepts ───
  // "Community center" = physicians + MH + recreation
  if (/community center|community hub|multipurpose/i.test(lower) && intervention.physicians === 0) {
    intervention.physicians = 3;
    intervention.mentalHealthProviders = Math.max(intervention.mentalHealthProviders, 2);
    intervention.parkAcres = Math.max(intervention.parkAcres, 10);
    parts.push('community center (health + wellness + recreation)');
  }

  // "Comprehensive" / "everything" / "full investment"
  if (/everything|comprehensive|full|all|maximum|complete overhaul|total/i.test(lower) && parts.length === 0) {
    intervention.physicians = 10;
    intervention.mentalHealthProviders = 5;
    intervention.groceryStores = 2;
    intervention.parkAcres = 100;
    intervention.childCareCenters = 3;
    intervention.insuranceSubsidyPct = 15;
    parts.push('comprehensive intervention');
  }

  // If nothing matched at all, default to a modest health intervention
  if (parts.length === 0) {
    intervention.physicians = 3;
    intervention.mentalHealthProviders = 2;
    intervention.parkAcres = 20;
    parts.push('general health intervention (default)');
  }

  return {
    intervention,
    summary: `Parsed: ${parts.join(' + ')}`,
    confidence: GROQ_API_KEY ? 0.5 : 0.6,
    reasoning: 'Rule-based extraction (LLM unavailable)',
  };
}
