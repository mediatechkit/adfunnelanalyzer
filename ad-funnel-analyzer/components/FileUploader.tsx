
import React, { useRef } from 'react';

// Added compact optional prop to fix type error in App.tsx
interface Props {
  onDataLoaded: (csv: string) => void;
  compact?: boolean;
}

const FileUploader: React.FC<Props> = ({ onDataLoaded, compact }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        onDataLoaded(text);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={`flex items-center gap-3 ${compact ? 'scale-95 origin-right' : ''}`}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleChange}
        accept=".csv"
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className={`inline-flex items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors ${compact ? 'px-3 py-1.5 text-xs' : ''}`}
      >
        <svg className="-ml-1 mr-2 h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        {compact ? 'Upload CSV' : 'Upload Meta Ads CSV'}
      </button>
    </div>
  );
};

export default FileUploader;
