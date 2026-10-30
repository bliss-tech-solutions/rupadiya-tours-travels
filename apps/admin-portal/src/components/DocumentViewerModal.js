'use client';

import React, { useState } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize2, 
  ExternalLink, 
  ShieldCheck, 
  FileText,
  AlertCircle
} from 'lucide-react';

export default function DocumentViewerModal({
  isOpen,
  onClose,
  title = 'Document Preview',
  documentType = 'AADHAAR',
  documentNumber = '',
  status = 'PENDING',
  fileUrl = '',
  fileUrlBack = '',
  onApprove = null,
  onReject = null
}) {
  const [activeSide, setActiveSide] = useState('front'); // 'front' | 'back'
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!isOpen) return null;

  const currentUrl = activeSide === 'front' ? fileUrl : (fileUrlBack || fileUrl);
  const hasBackSide = Boolean(fileUrlBack);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  const getDocLabel = (type) => {
    switch (type) {
      case 'NEPAL_CITIZENSHIP':
      case 'NEPAL_NATIONAL_ID':
        return 'Nepali Nagarikta (Citizenship Certificate)';
      case 'AADHAAR':
        return 'Aadhaar Card (UIDAI)';
      case 'PAN':
        return 'Income Tax PAN Card';
      default:
        return type || 'Government Identity Document';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/90 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200/60 font-black">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900">{getDocLabel(documentType)}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  status === 'VERIFIED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : status === 'REJECTED'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {status}
                </span>
              </div>
              {documentNumber && (
                <p className="text-xs font-mono text-slate-500 font-bold mt-0.5">
                  ID: <span className="text-slate-900">{documentNumber}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUrl && (
              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                title="Open in new window"
                className="p-2 rounded-xl text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Side Switcher & Zoom Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 bg-slate-100/70 border-b border-slate-200/90 text-xs">
          {/* Side Tabs */}
          {hasBackSide ? (
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
              <button
                type="button"
                onClick={() => { setActiveSide('front'); handleReset(); }}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                  activeSide === 'front'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Front Side
              </button>
              <button
                type="button"
                onClick={() => { setActiveSide('back'); handleReset(); }}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                  activeSide === 'back'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Back Side
              </button>
            </div>
          ) : (
            <span className="text-xs font-bold text-slate-500">Document Front View</span>
          )}

          {/* Zoom & Rotate Controls */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom out"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono font-bold px-1.5 text-slate-600 min-w-10 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom in"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <button
              type="button"
              onClick={handleRotate}
              title="Rotate 90 degrees"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-blue-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Document Viewing Canvas */}
        <div className="flex-1 overflow-auto p-6 bg-slate-900/5 min-h-[360px] flex items-center justify-center">
          {currentUrl ? (
            <div className="transition-transform duration-200 flex items-center justify-center max-w-full">
              <img
                src={currentUrl}
                alt={`${documentType} ${activeSide}`}
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  maxHeight: '58vh',
                  maxWidth: '100%',
                  objectFit: 'contain'
                }}
                className="rounded-xl shadow-lg border border-slate-200 bg-white"
              />
            </div>
          ) : (
            <div className="text-center p-8 text-slate-400 space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-bold">No document image attached for {activeSide} side.</p>
            </div>
          )}
        </div>

        {/* Bottom Actions (Optional KYC Approval Quick Actions) */}
        {(onApprove || onReject) && status === 'PENDING' && (
          <div className="px-6 py-4 border-t border-slate-200/90 bg-white flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500 font-medium">
              Review document clarity & validity before granting wallet authorization.
            </span>
            <div className="flex items-center gap-2">
              {onReject && (
                <button
                  type="button"
                  onClick={onReject}
                  className="px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold text-xs transition cursor-pointer"
                >
                  Reject Document
                </button>
              )}
              {onApprove && (
                <button
                  type="button"
                  onClick={onApprove}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
                >
                  Approve Verification
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

