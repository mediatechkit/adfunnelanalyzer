import { GoogleGenAI } from '@google/genai';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RawAdData, AnalyzedAd, FunnelStage } from './types';
import FileUploader from './components/FileUploader';
import Dashboard from './components/Dashboard';
import AdTable from './components/AdTable';
import InsightsPanel from './components/InsightsPanel';
import { runAnalysis } from './services/analyzer';
import { INITIAL_DATA_CSV } from './constants';

const Logo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M50 0L100 86.6H80L50 34.6L20 86.6H0L50 0Z" />
    <path d="M50 40L65 65L50 90L35 65L50 40Z" />
  </svg>
);

const App: React.FC = () => {
  const [data, setData] = useState<AnalyzedAd[]>([]);
  const [rawCsv, setRawCsv] = useState<string>(INITIAL_DATA_CSV);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableDays, setAvailableDays] = useState<number>(0);
  const [isDaily, setIsDaily] = useState<boolean>(false);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    // Only run analysis if we have content and it's not just the empty initial state
    // If it is the first load, we try silently; if it fails, we just show the empty state
    // But if a user UPLOADS, we must show the error.
    if (rawCsv.trim() !== "") {
      handleDataAnalysis(rawCsv, !isFirstLoad.current);
    }
    isFirstLoad.current = false;
  }, [rawCsv]);

  const handleDataLoaded = (csvString: string) => {
    setError(null);
    setRawCsv(csvString);
  };

  const handleDataAnalysis = (csvString: string, shouldShowError: boolean = true) => {
    setLoading(true);
    if (shouldShowError) setError(null);

    try {
      // Small timeout to allow UI to show loading state
      setTimeout(() => {
        try {
          const result = runAnalysis(csvString, 9999);
          setData(result.data);
          setAvailableDays(result.availableDays);
          setIsDaily(result.isDailyBreakdown);
          setLoading(false);
          setError(null);
        } catch (err: any) {
          setLoading(false);
          setData([]);
          if (shouldShowError) {
            setError(err.message || 'The file format is invalid. Please ensure all mandatory sections are present.');
          }
        }
      }, 50);
    } catch (err: any) {
      setLoading(false);
      if (shouldShowError) setError('Error processing file.');
    }
  };

  const funnelDistribution = useMemo(() => {
    const counts = { [FunnelStage.TOF]: 0, [FunnelStage.MOF]: 0, [FunnelStage.BOF]: 0 };
    data.forEach(ad => {
      if (counts[ad.funnelStage] !== undefined) counts[ad.funnelStage]++;
    });
    return counts;
  }, [data]);

  const hasData = data.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 w-full shrink-0">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => window.location.reload()}
            title="Refresh App"
          >
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-200 transition-transform group-hover:scale-105">
              <Logo className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-black">
              Ad Funnel Analyzer
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <FileUploader onDataLoaded={handleDataLoaded} compact={hasData} />
          </div>
        </div>
      </header>

      <main className="flex-grow w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {!hasData && !loading && !error ? (
          <div className="flex flex-col items-center justify-center py-24 animate-in fade-in zoom-in duration-700">
            <div className="w-24 h-24 bg-black rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-slate-200 mb-8 cursor-pointer hover:scale-105 transition-transform" onClick={() => window.location.reload()}>
               <Logo className="w-14 h-14" />
            </div>
            <FileUploader onDataLoaded={handleDataLoaded} />
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-10 w-full max-w-5xl text-center">
              <div className="group space-y-3 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="text-black font-black text-2xl group-hover:scale-110 transition-transform inline-block">01.</div>
                <h4 className="font-bold text-slate-800 text-lg">Export CSV</h4>
                <p className="text-slate-500 text-sm leading-relaxed">Ensure all performance metrics are included in your Meta Ads Manager export.</p>
              </div>
              <div className="group space-y-3 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="text-black font-black text-2xl group-hover:scale-110 transition-transform inline-block">02.</div>
                <h4 className="font-bold text-slate-800 text-lg">Upload File</h4>
                <p className="text-slate-500 text-sm leading-relaxed">Drop your file into the analyzer to group ad performance into TOF, MOF, and BOF stages.</p>
              </div>
              <div className="group space-y-3 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="text-black font-black text-2xl group-hover:scale-110 transition-transform inline-block">03.</div>
                <h4 className="font-bold text-slate-800 text-lg">Scale Profit</h4>
                <p className="text-slate-500 text-sm leading-relaxed">Receive automated recommendations for scaling budget or rotating tired creative assets.</p>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-40 space-y-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-slate-100"></div>
              <div className="absolute top-0 w-20 h-20 rounded-full border-4 border-black border-t-transparent animate-spin"></div>
            </div>
            <div className="text-center">
              <p className="text-slate-900 font-black text-xl uppercase tracking-tighter">Analyzing Performance</p>
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">
                {isDaily ? `Processing Time-Series Data` : 'Processing Summary Report'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {error && (
              <div className="max-w-3xl mx-auto mt-8 flex flex-col items-center">
                <div className="bg-white border-2 border-red-100 p-8 rounded-3xl flex flex-col items-center text-center gap-6 shadow-2xl shadow-red-50/50">
                  <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Invalid File Format</h3>
                    <p className="mt-2 text-slate-500 font-medium leading-relaxed">
                      {error}
                    </p>
                  </div>
                  <FileUploader onDataLoaded={handleDataLoaded} />
                </div>
              </div>
            )}
            
            {hasData && (
              <>
                <Dashboard 
                  data={data} 
                  distribution={funnelDistribution} 
                  availableDays={availableDays}
                  isDaily={isDaily}
                />
                
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-8">
                    <AdTable data={data} />
                  </div>
                  <div className="lg:col-span-4 sticky top-24">
                    <InsightsPanel data={data} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-12 mt-auto">
        <div className="max-w-[1600px] mx-auto px-4 flex flex-col items-center text-center space-y-2">
          <div className="text-black mb-2 cursor-pointer hover:scale-110 transition-transform" onClick={() => window.location.reload()}>
            <Logo className="w-8 h-8 opacity-50" />
          </div>
          <p className="font-black text-black tracking-tight text-lg">Ad Funnel Analyzer</p>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">© 2026 Ahsan Abidi • Mediatech Consulting</p>
        </div>
      </footer>
    </div>
  );
};

export default App;