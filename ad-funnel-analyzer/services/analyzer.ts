import { RawAdData, AnalyzedAd, FunnelStage, AdPerformanceStatus } from '../types';

export interface AnalysisResult {
  data: AnalyzedAd[];
  availableDays: number;
  isDailyBreakdown: boolean;
}

/**
 * Mandatory sections required for the diagnostic engine.
 * We use patterns that cover common Meta Ads Manager export naming conventions.
 */
const REQUIRED_COLUMN_GROUPS = [
  { id: 'campaign', name: 'Campaign Name', patterns: ['campaign name'] },
  { id: 'adset', name: 'Ad Set Name', patterns: ['ad set name'] },
  { id: 'ad', name: 'Ad Name', patterns: ['ad name'] },
  { id: 'spend', name: 'Amount Spent', patterns: ['amount spent', 'spend'] },
  { id: 'impressions', name: 'Impressions', patterns: ['impressions'] },
  { id: 'clicks', name: 'Link Clicks', patterns: ['link clicks', 'clicks'] },
  { id: 'purchases', name: 'Purchases/Results', patterns: ['purchases', 'results'] },
  { id: 'frequency', name: 'Frequency', patterns: ['frequency'] },
  { id: 'ad_delivery', name: 'Ad Delivery', patterns: ['ad delivery', 'ad status'] },
  { id: 'campaign_delivery', name: 'Campaign Delivery', patterns: ['campaign delivery', 'campaign status'] },
  { id: 'ad_set_delivery', name: 'Ad Set Delivery', patterns: ['ad set delivery', 'ad set status'] }
];

const parseDate = (dateStr: string | undefined): number => {
  if (!dateStr) return NaN;
  let cleaned = dateStr.trim().replace(/"/g, '');
  if (!cleaned || cleaned.toLowerCase() === 'all' || cleaned.toLowerCase() === 'total') return NaN;
  
  let timestamp = Date.parse(cleaned);
  if (!isNaN(timestamp)) return timestamp;

  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthIdx = months.findIndex(m => cleaned.toLowerCase().includes(m));
  
  if (monthIdx !== -1) {
    const numbers = cleaned.match(/\d+/g);
    if (numbers && numbers.length >= 2) {
      const year = numbers.find(n => n.length === 4) || new Date().getFullYear().toString();
      const day = numbers.find(n => n.length <= 2 && n !== (monthIdx + 1).toString()) || "1";
      return new Date(parseInt(year), monthIdx, parseInt(day)).getTime();
    }
  }

  const parts = cleaned.split(/[-/.]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0]);
    const p1 = parseInt(parts[1]);
    const p2 = parseInt(parts[2]);

    if (parts[0].length === 4) return new Date(p0, p1 - 1, p2).getTime();
    if (p0 > 12) return new Date(p2, p1 - 1, p0).getTime();
    return new Date(p2, p0 - 1, p1).getTime();
  }
  
  return NaN;
};

/**
 * Normalizes Meta Ads delivery status.
 * Handles variations like 'not_delivering' or 'inactive' to ensure they aren't marked 'Active'.
 */
const normalizeDelivery = (status: string | undefined): string => {
  if (!status) return 'Inactive';
  const s = status.toLowerCase().trim();
  
  // Explicitly check for strings that indicate "Not Active"
  // Using underscores or spaces to handle common export formats
  if (
    s.includes('inactive') || 
    s.includes('not') || 
    s.includes('paused') || 
    s.includes('off') || 
    s.includes('disabled') ||
    s.includes('rejected') ||
    s.includes('archived')
  ) {
    return 'Inactive';
  }
  
  // Only return 'Active' for known delivery signals
  const activeVariants = ['active', 'on', 'delivering', 'learning', 'scheduled'];
  if (activeVariants.some(v => s === v || s.includes(v))) {
    return 'Active';
  }
  
  return 'Inactive';
};

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else current += char;
  }
  result.push(current.trim());
  return result;
};

export const runAnalysis = (csvString: string, daysLookback: number = 30): AnalysisResult => {
  const cleanCsv = csvString.replace(/^\uFEFF/, '').trim();
  const lines = cleanCsv.split(/\r?\n/);
  
  if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) {
    throw new Error("Invalid Format: The uploaded file is completely empty.");
  }

  if (!lines[0].includes(',')) {
    throw new Error("Invalid Format: No column delimiters detected. Ensure you upload a CSV file.");
  }

  const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));
  
  const missingSections: string[] = [];
  REQUIRED_COLUMN_GROUPS.forEach(group => {
    const found = headers.some(h => {
      const headerLower = h.toLowerCase();
      return group.patterns.some(p => {
        const patternLower = p.toLowerCase();
        // Exact match or contains the phrase (with some wiggle room for suffixes like '(USD)')
        return headerLower === patternLower || headerLower.includes(patternLower);
      });
    });
    if (!found) missingSections.push(group.name);
  });

  if (missingSections.length > 0) {
    throw new Error(`Requirement Error: Missing [${missingSections.join(', ')}]. Please check your Meta Ads export settings.`);
  }

  const rows = lines.slice(1);
  
  const rawRows: any[] = rows.map((row) => {
    const cols = parseCSVLine(row);
    if (cols.length < headers.length * 0.5) return null;

    const getVal = (possibleHeaders: string[]) => {
      const idx = headers.findIndex(h => {
        const headerLower = h.toLowerCase();
        return possibleHeaders.some(ph => {
          const phLower = ph.toLowerCase();
          return headerLower === phLower || headerLower.includes(phLower);
        });
      });
      if (idx === -1) return undefined;
      return cols[idx]?.replace(/^"|"$/g, '').trim();
    };

    const adName = getVal(['Ad name']);
    if (!adName) return null;

    return {
      campaignName: getVal(['Campaign name']) || 'Unknown',
      adSetName: getVal(['Ad set name']) || 'Unknown',
      adName: adName,
      spend: parseFloat((getVal(['Amount spent', 'Spend']) || '0').replace(/[^0-9.]/g, '')),
      impressions: parseInt((getVal(['Impressions']) || '0').replace(/[^0-9]/g, '')),
      clicks: parseInt((getVal(['Link clicks', 'Clicks']) || '0').replace(/[^0-9]/g, '')),
      landingPageViews: parseInt((getVal(['landing page views']) || '0').replace(/[^0-9]/g, '')),
      atc: parseInt((getVal(['Adds to cart', 'Add to cart']) || '0').replace(/[^0-9]/g, '')),
      purchases: parseInt((getVal(['Purchases', 'Results']) || '0').replace(/[^0-9]/g, '')),
      conversionValue: parseFloat((getVal(['conversion value', 'Result value']) || '0').replace(/[^0-9.]/g, '')),
      frequency: parseFloat(getVal(['Frequency']) || '1.0'),
      day: getVal(['Day', 'Date']),
      reportingStart: getVal(['Reporting starts']),
      reportingEnd: getVal(['Reporting ends']),
      adDelivery: getVal(['Ad Delivery', 'Ad Status']) || 'Inactive',
      campaignDelivery: getVal(['Campaign Delivery', 'Campaign Status']) || 'Inactive',
      adSetDelivery: getVal(['Ad Set Delivery', 'Ad Set Status']) || 'Inactive'
    };
  }).filter(r => r !== null);

  const rowDataWithTime = rawRows.map(r => ({ ...r, timestamp: parseDate(r.day) }));
  const validTimestamps = rowDataWithTime.map(r => r.timestamp).filter(t => !isNaN(t));
  const uniqueDates = new Set(validTimestamps);
  const isDailyBreakdown = uniqueDates.size > 1;

  let availableDaysCount = 1;
  let filteredRows = rawRows;

  if (isDailyBreakdown) {
    const latest = Math.max(...validTimestamps);
    const earliest = Math.min(...validTimestamps);
    const oneDayMs = 24 * 60 * 60 * 1000;
    availableDaysCount = Math.max(1, Math.round((latest - earliest) / oneDayMs) + 1);
    const cutoff = latest - ((daysLookback - 1) * oneDayMs);
    filteredRows = rowDataWithTime.filter(r => !isNaN(r.timestamp) && r.timestamp >= (cutoff - 1000));
  } else {
    let minStart = Infinity, maxEnd = -Infinity;
    rawRows.forEach(r => {
      const s = parseDate(r.reportingStart), e = parseDate(r.reportingEnd);
      if (!isNaN(s)) minStart = Math.min(minStart, s);
      if (!isNaN(e)) maxEnd = Math.max(maxEnd, e);
    });
    if (minStart !== Infinity && maxEnd !== -Infinity) {
      availableDaysCount = Math.max(1, Math.round((maxEnd - minStart) / (24 * 60 * 60 * 1000)) + 1);
    }
  }

  return { data: aggregate(filteredRows), availableDays: availableDaysCount, isDailyBreakdown };
};

const aggregate = (rows: any[]): AnalyzedAd[] => {
  const aggregated: Record<string, any> = {};
  rows.forEach(row => {
    const key = `${row.campaignName}|${row.adSetName}|${row.adName}`;
    if (!aggregated[key]) {
      aggregated[key] = { ...row };
    } else {
      aggregated[key].spend += row.spend;
      aggregated[key].impressions += row.impressions;
      aggregated[key].clicks += row.clicks;
      aggregated[key].purchases += row.purchases;
      aggregated[key].conversionValue += row.conversionValue;
      aggregated[key].frequency = Math.max(aggregated[key].frequency, row.frequency);
    }
  });

  return Object.values(aggregated).map((ad, index) => {
    const cpm = ad.impressions > 0 ? (ad.spend / ad.impressions) * 1000 : 0;
    const ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions) : 0;
    const cpa = ad.purchases > 0 ? (ad.spend / ad.purchases) : 0;
    const roas = ad.spend > 0 ? (ad.conversionValue / ad.spend) : 0;
    const { stage, confidence, reasoning } = classifyFunnelStage(cpm, ctr, ad.purchases, cpa, ad.frequency);
    
    const adDel = normalizeDelivery(ad.adDelivery);
    const campDel = normalizeDelivery(ad.campaignDelivery);
    const setDel = normalizeDelivery(ad.adSetDelivery);

    let finalDelivery = adDel;
    if (campDel === 'Inactive' || setDel === 'Inactive') finalDelivery = 'Inactive';

    return {
      ...ad,
      id: `ad-${index}`,
      cpm, ctr, cpa,
      convRate: ad.clicks > 0 ? (ad.purchases / ad.clicks) : 0,
      roas, funnelStage: stage, confidence, reasoning,
      status: determineStatus(stage, cpa, ad.purchases, ad.frequency, ctr),
      deliveryStatus: finalDelivery
    };
  });
};

const classifyFunnelStage = (cpm: number, ctr: number, purchases: number, cpa: number, freq: number) => {
  if (freq > 2.0 || (purchases > 3 && cpa < 180)) {
    return { stage: FunnelStage.BOF, confidence: 'High' as const, reasoning: 'Consistent interaction frequency and conversions detected.' };
  }
  if (freq > 1.1 && (purchases > 0 || ctr > 0.007)) {
    return { stage: FunnelStage.MOF, confidence: 'Medium' as const, reasoning: 'Mid-range frequency and click engagement levels.' };
  }
  return { stage: FunnelStage.TOF, confidence: 'High' as const, reasoning: 'Discovery reach patterns detected.' };
};

const determineStatus = (stage: FunnelStage, cpa: number, purchases: number, freq: number, ctr: number): AdPerformanceStatus => {
  if (freq > 4.5) return AdPerformanceStatus.SATURATED;
  if (purchases > 5 && cpa < 75) return AdPerformanceStatus.SCALING_CANDIDATE;
  if (purchases === 0 && ctr < 0.0035) return AdPerformanceStatus.UNDERPERFORMING;
  return AdPerformanceStatus.HEALTHY;
};