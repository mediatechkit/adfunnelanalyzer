
import React, { useState, useEffect } from 'react';
// Fixed: Changed AdStatus to AdPerformanceStatus to match the exported enum in types.ts
import { AnalyzedAd, FunnelStage, AdPerformanceStatus } from '../types';
import { GoogleGenAI } from "@google/genai";

interface Props {
  data: AnalyzedAd[];
}

const InsightsPanel: React.FC<Props> = ({ data }) => {
  const [insights, setInsights] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

  // Generate automated rules-based insights immediately
  useEffect(() => {
    const generated = generateRulesInsights(data);
    setInsights(generated);
  }, [data]);

  const generateAIInsights = async () => {
    if (!process.env.API_KEY) {
      alert("API Key missing. Rules-based insights only.");
      return;
    }

    setGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        Analyze this Meta Ads performance data.
        Context: 
        ${JSON.stringify(data.slice(0, 15).map(ad => ({
          name: ad.adName,
          stage: ad.funnelStage,
          spend: ad.spend,
          cpa: ad.cpa,
          freq: ad.frequency,
          purch: ad.purchases
        })))}

        Task: Provide 3 deep performance marketing insights.
        Format as JSON array of objects: { title, type: 'Alert'|'Opportunity', content, action }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const aiInsights = JSON.parse(response.text || '[]');
      setInsights(prev => [...aiInsights, ...prev].slice(0, 6));
    } catch (err) {
      console.error("AI Insight generation failed", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-bold text-slate-800">Insights & Actions</h3>
        <button 
          onClick={generateAIInsights}
          disabled={generating}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
        >
          {generating ? 'Processing...' : 'Enhance with AI'}
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>
      </div>
      <div className="p-4 space-y-4 overflow-y-auto max-h-[600px]">
        {insights.length === 0 && (
          <p className="text-center text-slate-400 py-10 text-sm">No critical alerts detected.</p>
        )}
        {insights.map((insight, idx) => (
          <div key={idx} className={`p-4 rounded-lg border-l-4 ${getTypeStyles(insight.type)}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{insight.type}</span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">{insight.title}</h4>
            <p className="text-xs text-slate-600 mb-3 leading-relaxed">{insight.content}</p>
            <div className="bg-white/50 p-2 rounded text-[11px] font-medium text-slate-700 border border-slate-100">
              <span className="text-indigo-600 font-bold">Action:</span> {insight.action}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function getTypeStyles(type: string) {
  switch (type) {
    case 'Alert':
    case 'Risk': return 'bg-red-50 border-red-400';
    case 'Opportunity': return 'bg-green-50 border-green-400';
    default: return 'bg-indigo-50 border-indigo-400';
  }
}

function generateRulesInsights(data: AnalyzedAd[]) {
  const insights = [];

  // Saturation Check
  // Fixed: Changed ad.status check to use AdPerformanceStatus enum
  const saturated = data.filter(ad => ad.status === AdPerformanceStatus.SATURATED);
  if (saturated.length > 0) {
    insights.push({
      type: 'Risk',
      title: 'Audience Fatigue Detected',
      content: `${saturated.length} BOF ads show high frequency (>4.5) with rising CPA. Ad names: ${saturated.map(a => a.adName).join(', ')}.`,
      action: 'Rotate creatives immediately or expand the lookalike audience percentage.'
    });
  }

  // Scaling Check
  // Fixed: Changed ad.status check to use AdPerformanceStatus enum
  const scalables = data.filter(ad => ad.status === AdPerformanceStatus.SCALING_CANDIDATE);
  if (scalables.length > 0) {
    insights.push({
      type: 'Opportunity',
      title: 'Scaling Candidate Identified',
      content: `${scalables.length} ads are performing significantly below target CPA with consistent purchases.`,
      action: 'Increase budget by 20% every 48 hours while monitoring frequency guardrails.'
    });
  }

  // Funnel Gap Check
  const tofAds = data.filter(ad => ad.funnelStage === FunnelStage.TOF);
  const bofAds = data.filter(ad => ad.funnelStage === FunnelStage.BOF);
  if (tofAds.length > 0 && bofAds.length === 0) {
    insights.push({
      type: 'Alert',
      title: 'Retargeting Gap',
      content: 'You have active prospecting (TOF) ads but no bottom-funnel (BOF) retargeting layers.',
      action: 'Create a Website Visitors (30d) custom audience and launch a Dynamic Product Ad (DPA) campaign.'
    });
  }

  return insights;
}

export default InsightsPanel;
