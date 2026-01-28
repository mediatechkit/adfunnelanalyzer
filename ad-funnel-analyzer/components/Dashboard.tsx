import React from 'react';
import { AnalyzedAd, FunnelStage } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface Props {
  data: AnalyzedAd[];
  distribution: Record<FunnelStage, number>;
  availableDays: number;
  isDaily: boolean;
}

const Dashboard: React.FC<Props> = ({ data, distribution, availableDays, isDaily }) => {
  const chartData = Object.entries(distribution).map(([name, value]) => ({ name, value }));
  
  const COLORS = {
    [FunnelStage.TOF]: '#6366f1', // indigo
    [FunnelStage.MOF]: '#8b5cf6', // violet
    [FunnelStage.BOF]: '#d946ef', // fuchsia
  };

  // Fixed: Use strict equality comparison to avoid 'Inactive' matching because it contains 'active'
  const activeAdsCount = data.filter(ad => 
    ad.deliveryStatus === 'Active'
  ).length;

  const inactiveAdsCount = data.length - activeAdsCount;

  const totals = {
    spend: data.reduce((sum, ad) => sum + ad.spend, 0),
    purchases: data.reduce((sum, ad) => sum + ad.purchases, 0),
    avgRoas: data.length > 0 ? data.reduce((sum, ad) => sum + ad.roas, 0) / data.length : 0,
    avgCpa: data.reduce((sum, ad) => sum + ad.purchases, 0) > 0 ? data.reduce((sum, ad) => sum + ad.spend, 0) / data.reduce((sum, ad) => sum + ad.purchases, 0) : 0
  };

  const dateRangeLabel = availableDays > 0 
    ? `${availableDays} ${availableDays === 1 ? 'Day' : 'Days'} Range` 
    : "Full Period";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Performance Overview
            {!isDaily && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] uppercase font-black rounded-md tracking-widest border border-slate-200">
                Summary Report
              </span>
            )}
          </h2>
          <p className="text-slate-500 text-sm">
            Analysis based on the {availableDays}-day span provided in your data export.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Total Spend" value={`$${totals.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} subtitle={dateRangeLabel} />
        <KpiCard title="Total Purchases" value={totals.purchases.toString()} subtitle="Conversions in range" />
        <KpiCard title="Avg CPA" value={`$${totals.avgCpa.toFixed(2)}`} subtitle="Efficiency metric" />
        <KpiCard title="Avg ROAS" value={`${totals.avgRoas.toFixed(2)}x`} subtitle="Return on ad spend" />
        <KpiCard title="Ad Status" value={`${activeAdsCount} Active`} subtitle={`${inactiveAdsCount} Inactive`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm col-span-1">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Funnel Distribution</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={COLORS[entry.name as FunnelStage]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-2">
            {Object.entries(COLORS).map(([stage, color]) => (
              <div key={stage} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                <span className="text-xs font-medium text-slate-600">{stage}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm col-span-2">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Metric Performance by Stage</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aggregateByStage(data)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="stage" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="avgCpm" name="Avg CPM ($)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgCpa" name="Avg CPA ($)" fill="#d946ef" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const KpiCard: React.FC<{ title: string; value: string; subtitle: string }> = ({ title, value, subtitle }) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300">
    <p className="text-sm font-medium text-slate-500">{title}</p>
    <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
  </div>
);

function aggregateByStage(data: AnalyzedAd[]) {
  const stages = [FunnelStage.TOF, FunnelStage.MOF, FunnelStage.BOF];
  return stages.map(stage => {
    const subset = data.filter(ad => ad.funnelStage === stage);
    if (subset.length === 0) return { stage, avgCpm: 0, avgCpa: 0 };
    return {
      stage,
      avgCpm: subset.reduce((sum, ad) => sum + ad.cpm, 0) / subset.length,
      avgCpa: subset.reduce((sum, ad) => sum + ad.purchases, 0) > 0 
        ? subset.reduce((sum, ad) => sum + ad.spend, 0) / subset.reduce((sum, ad) => sum + ad.purchases, 0)
        : 0
    };
  });
}

export default Dashboard;