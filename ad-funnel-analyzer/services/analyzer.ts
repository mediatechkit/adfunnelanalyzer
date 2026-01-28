import { RawAdData, AnalyzedAd, FunnelStage, AdPerformanceStatus } from '../types';

export interface AnalysisResult {
  data: AnalyzedAd[];
  availableDays: number;
  isDailyBreakdown: boolean;
}

const parseDate = (dateStr: string | undefined): number => {
  if (!dateStr) return NaN;
  let cleaned = dateStr.trim().replace(/"/g, '');
  if (!cleaned || cleaned.toLowerCase() === 'all' || cleaned.toLowerCase() === 'total') return NaN;
  
  // Standard parsing
  let timestamp = Date.parse(cleaned);
  if (!isNaN(timestamp)) return timestamp;

  // Localized/Meta specific Month name parsing
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

  // Common separators: DD.MM.YYYY, MM/DD/YYYY, etc.
  const parts = cleaned.split(/[-/.]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0]);
    const p1 = parseInt(parts[1]);
    const p2 = parseInt(parts[2]);

    // YYYY-MM-DD
    if (parts[0].length === 4) return new Date(p0, p1 - 1, p2).getTime();
    // DD-MM-YYYY or MM-DD-YYYY
    if (p0 > 12) return new Date(p2, p1 - 1, p0).getTime();
    return new Date(p2, p0 - 1, p1).getTime();
  }
  
  return NaN;
};

const normalizeDelivery = (status: string | undefined): string => {
  if (!status) return 'Inactive';
  const s = status.toLowerCase().trim();
  const inactiveVariants = ['inactive', 'off', 'paused', 'disabled', 'completed', 'not_approved', 'rejected', 'deleted', 'archived', 'not delivering'];
  if (inactiveVariants.some(v => s.includes(v))) return 'Inactive';
  if (s === 'active' || s === 'on' || s.includes('delivering')) return 'Active';
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
  if (lines.length < 2) return { data: [], availableDays: 0, isDailyBreakdown: false };

  const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1);
  
  const rawRows: any[] = rows.map(row => {
    const cols = parseCSVLine(row);
    const getVal = (possibleHeaders: string[]) => {
      const idx = headers.findIndex(h => 
        possibleHeaders.some(ph => ph.toLowerCase() === h.toLowerCase())
      );
      if (idx === -1) return undefined;
      return cols[idx]?.replace(/^"|"$/g, '').trim();
    };

    const dayVal = getVal(['Day', 'Date', 'Time']);
    const startVal = getVal(['Reporting starts']);
    const endVal = getVal(['Reporting ends']);

    return {
      campaignName: getVal(['Campaign name']) || '',
      adSetName: getVal(['Ad set name']) || '',
      adName: getVal(['Ad name']) || '',
      spend: parseFloat((getVal(['Amount spent (USD)', 'Spend', 'Amount spent']) || '0').replace(/[^0-9.]/g, '')),
      impressions: parseInt((getVal(['Impressions']) || '0').replace(/[^0-9]/g, '')),
      clicks: parseInt((getVal(['Link clicks', 'Clicks']) || '0').replace(/[^0-9]/g, '')),
      landingPageViews: parseInt((getVal(['Website landing page views', 'Landing page views']) || '0').replace(/[^0-9]/g, '')),
      atc: parseInt((getVal(['Adds to cart', 'Add to cart']) || '0').replace(/[^0-9]/g, '')),
      purchases: parseInt((getVal(['Purchases', 'Results']) || '0').replace(/[^0-9]/g, '')),
      conversionValue: parseFloat((getVal(['Purchases conversion value', 'Result value']) || '0').replace(/[^0-9.]/g, '')),
      frequency: parseFloat(getVal(['Frequency']) || '1.0'),
      day: dayVal,
      reportingStart: startVal,
      reportingEnd: endVal,
      adDelivery: getVal(['Ad Delivery', 'Delivery', 'Status']) || 'Inactive',
      campaignDelivery: getVal(['Campaign Delivery']) || '',
      adSetDelivery: getVal(['Ad Set Delivery']) || ''
    };
  }).filter(r => r.adName);

  if (rawRows.length === 0) return { data: [], availableDays: 0, isDailyBreakdown: false };

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
    let minStart = Infinity;
    let maxEnd = -Infinity;
    rawRows.forEach(r => {
      const s = parseDate(r.reportingStart);
      const e = parseDate(r.reportingEnd);
      if (!isNaN(s)) minStart = Math.min(minStart, s);
      if (!isNaN(e)) maxEnd = Math.max(maxEnd, e);
    });
    if (minStart !== Infinity && maxEnd !== -Infinity) {
      availableDaysCount = Math.max(1, Math.round((maxEnd - minStart) / (24 * 60 * 60 * 1000)) + 1);
    }
  }

  return { 
    data: aggregate(filteredRows), 
    availableDays: availableDaysCount, 
    isDailyBreakdown 
  };
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
      aggregated[key].landingPageViews += row.landingPageViews;
      aggregated[key].atc += row.atc;
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
    
    // Check Campaign and Ad Set level delivery as well
    const adDel = normalizeDelivery(ad.adDelivery);
    const campDel = normalizeDelivery(ad.campaignDelivery);
    const setDel = normalizeDelivery(ad.adSetDelivery);

    let finalDelivery = adDel;
    if (campDel === 'Inactive' || setDel === 'Inactive') {
      finalDelivery = 'Inactive';
    }

    return {
      ...ad,
      id: `ad-${index}`,
      cpm,
      ctr,
      cpa,
      convRate: ad.clicks > 0 ? (ad.purchases / ad.clicks) : 0,
      roas,
      funnelStage: stage,
      confidence,
      reasoning,
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
  return { stage: FunnelStage.TOF, confidence: 'High' as const, reasoning: 'Fresh reach with low repetition suggests a discovery audience.' };
};

const determineStatus = (stage: FunnelStage, cpa: number, purchases: number, freq: number, ctr: number): AdPerformanceStatus => {
  if (freq > 4.5) return AdPerformanceStatus.SATURATED;
  if (purchases > 5 && cpa < 75) return AdPerformanceStatus.SCALING_CANDIDATE;
  if (purchases === 0 && ctr < 0.0035) return AdPerformanceStatus.UNDERPERFORMING;
  return AdPerformanceStatus.HEALTHY;
};