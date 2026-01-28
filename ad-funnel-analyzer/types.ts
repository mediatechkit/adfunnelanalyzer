
export enum FunnelStage {
  TOF = 'TOF',
  MOF = 'MOF',
  BOF = 'BOF'
}

export enum AdPerformanceStatus {
  HEALTHY = 'Healthy',
  SATURATED = 'Saturated',
  UNDERPERFORMING = 'Underperforming',
  SCALING_CANDIDATE = 'Scaling Candidate'
}

export type DeliveryStatus = 'Active' | 'Inactive' | 'Off' | 'On' | 'Pending';

export interface RawAdData {
  campaignName: string;
  adSetName: string;
  adName: string;
  spend: number;
  impressions: number;
  clicks: number;
  landingPageViews: number;
  atc: number;
  purchases: number;
  conversionValue: number;
  frequency: number;
  day?: string; // Format: YYYY-MM-DD
}

export interface AnalyzedAd extends RawAdData {
  id: string;
  cpm: number;
  ctr: number;
  cpa: number;
  convRate: number;
  roas: number;
  funnelStage: FunnelStage;
  confidence: 'High' | 'Medium' | 'Low';
  reasoning: string;
  status: AdPerformanceStatus;
  deliveryStatus: string;
}

export interface FunnelMetrics {
  stage: FunnelStage;
  avgCpm: number;
  avgCtr: number;
  avgFrequency: number;
  avgCpa: number;
  totalPurchases: number;
  adCount: number;
}

export interface Insight {
  id: string;
  type: 'Risk' | 'Opportunity' | 'Alert';
  title: string;
  content: string;
  action: string;
  affectedAds: string[];
}
