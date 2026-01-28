import React, { useState, useMemo } from 'react';
import { AnalyzedAd, FunnelStage, AdPerformanceStatus } from '../types';

interface Props {
  data: AnalyzedAd[];
}

type SortConfig = {
  key: keyof AnalyzedAd | null;
  direction: 'asc' | 'desc';
};

const AdTable: React.FC<Props> = ({ data }) => {
  const [filter, setFilter] = useState<FunnelStage | 'ALL'>('ALL');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });

  const handleSort = (key: keyof AnalyzedAd) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredData = useMemo(() => {
    let result = filter === 'ALL' ? [...data] : data.filter(ad => ad.funnelStage === filter);

    if (sortConfig.key) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        if (aValue === bValue) return 0;
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        
        if (sortConfig.direction === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    return result;
  }, [data, filter, sortConfig]);

  const SortIndicator = ({ columnKey }: { columnKey: keyof AnalyzedAd }) => {
    if (sortConfig.key !== columnKey) {
      return (
        <svg className="w-3 h-3 ml-1 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      );
    }
    return (
      <svg className={`w-3 h-3 ml-1 text-indigo-600 transition-transform ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    );
  };

  const HeaderCell = ({ label, columnKey, align = 'left' }: { label: string, columnKey: keyof AnalyzedAd, align?: 'left' | 'right' }) => (
    <th 
      onClick={() => handleSort(columnKey)}
      className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'} text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-100 transition-colors`}
    >
      <div className={`flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        {label}
        <SortIndicator columnKey={columnKey} />
      </div>
    </th>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-lg font-bold text-slate-800">Ad Performance Breakdown</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase">Filter:</span>
          {(['ALL', ...Object.values(FunnelStage)] as const).map((stage) => (
            <button
              key={stage}
              onClick={() => setFilter(stage)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                filter === stage 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {stage}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <HeaderCell label="Delivery" columnKey="deliveryStatus" />
              <HeaderCell label="Ad Name" columnKey="adName" />
              <HeaderCell label="Stage" columnKey="funnelStage" />
              <HeaderCell label="Health" columnKey="status" />
              <HeaderCell label="Spend" columnKey="spend" align="right" />
              <HeaderCell label="CPM" columnKey="cpm" align="right" />
              <HeaderCell label="CTR" columnKey="ctr" align="right" />
              <HeaderCell label="PUR" columnKey="purchases" align="right" />
              <HeaderCell label="CPA" columnKey="cpa" align="right" />
              <HeaderCell label="Freq" columnKey="frequency" align="right" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {sortedAndFilteredData.map((ad) => (
              <tr key={ad.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className={`w-2.5 h-2.5 rounded-full mr-2 ${getDeliveryColor(ad.deliveryStatus)}`}></div>
                    <span className={`text-sm capitalize font-medium ${getDeliveryTextColor(ad.deliveryStatus)}`}>
                      {ad.deliveryStatus}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-slate-900 truncate max-w-[180px]" title={ad.adName}>{ad.adName}</div>
                  <div className="text-xs text-slate-500 truncate max-w-[180px]">{ad.adSetName}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${getStageStyles(ad.funnelStage)}`}>
                    {ad.funnelStage}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyles(ad.status)}`}>
                    {ad.status}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-slate-600">${ad.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-slate-600">${ad.cpm.toFixed(2)}</td>
                <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-slate-600">{(ad.ctr * 100).toFixed(2)}%</td>
                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-semibold text-slate-900">{ad.purchases}</td>
                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-semibold text-slate-900">
                  {ad.purchases > 0 ? `$${ad.cpa.toFixed(2)}` : '--'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-slate-500">{ad.frequency.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function getStageStyles(stage: FunnelStage) {
  switch (stage) {
    case FunnelStage.TOF: return 'bg-indigo-50 text-indigo-700';
    case FunnelStage.MOF: return 'bg-violet-50 text-violet-700';
    case FunnelStage.BOF: return 'bg-fuchsia-50 text-fuchsia-700';
  }
}

function getStatusStyles(status: AdPerformanceStatus) {
  switch (status) {
    case AdPerformanceStatus.HEALTHY: return 'bg-green-100 text-green-800';
    case AdPerformanceStatus.SCALING_CANDIDATE: return 'bg-blue-100 text-blue-800 animate-pulse';
    case AdPerformanceStatus.SATURATED: return 'bg-orange-100 text-orange-800';
    case AdPerformanceStatus.UNDERPERFORMING: return 'bg-red-100 text-red-800';
  }
}

function getDeliveryColor(status: string) {
  const s = status.toLowerCase();
  
  if (s.includes('inactive') || s.includes('off') || s.includes('not')) {
    return 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]';
  }
  
  if (s === 'active' || s === 'on' || s.includes('delivering')) {
    return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]';
  }
  
  if (s.includes('pending') || s.includes('learning')) {
    return 'bg-yellow-400';
  }
  
  return 'bg-slate-200';
}

function getDeliveryTextColor(status: string) {
  const s = status.toLowerCase();
  
  if (s.includes('inactive') || s.includes('off') || s.includes('not')) {
    return 'text-orange-700 font-semibold';
  }
  
  if (s === 'active' || s === 'on' || s.includes('delivering')) {
    return 'text-slate-700';
  }
  
  return 'text-slate-500';
}

export default AdTable;