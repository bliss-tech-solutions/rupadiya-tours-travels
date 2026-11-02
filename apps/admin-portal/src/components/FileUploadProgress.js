'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, X, FileText, AlertCircle, Eye } from 'lucide-react';
import { api } from '../lib/api';

export default function FileUploadProgress({
  label,
  description,
  fileUrl,
  currentUrl,
  value,
  onUploadComplete,
  onUploadSuccess,
  onChange,
  onRemove,
  folder = 'documents',
  accept = 'image/*,application/pdf',
  required = false
}) {
  const effectiveUrl = fileUrl || currentUrl || value || '';
  const handleUploadDone = onUploadComplete || onUploadSuccess || onChange;

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB');
      return;
    }

    setError('');
    setUploading(true);
    setProgress(5);
    setFileName(file.name);

    try {
      const res = await api.uploadFile(file, folder, (percent) => {
        setProgress(Math.max(10, percent));
      });

      if (res?.url) {
        setProgress(100);
        setTimeout(() => {
          setUploading(false);
          try {
            if (typeof handleUploadDone === 'function') {
              handleUploadDone(res.url, res.key);
            }
          } catch (callbackErr) {
            console.error('[FileUploadProgress] Error in onUploadComplete:', callbackErr);
            setError(callbackErr?.message || 'Error processing uploaded file');
          }
        }, 300);
      } else {
        throw new Error('Upload returned no URL');
      }
    } catch (err) {
      setError(err.message || 'Upload failed');
      setUploading(false);
      setProgress(0);
    }
  };

  const handleRemove = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFileName('');
    setProgress(0);
    setError('');
    try {
      if (typeof onRemove === 'function') {
        onRemove();
      }
    } catch (err) {
      console.error('[FileUploadProgress] Error in onRemove:', err);
    }
  };

  const isPdf = effectiveUrl?.toLowerCase().endsWith('.pdf') || fileName.toLowerCase().endsWith('.pdf');

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs font-bold text-slate-700 block">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {effectiveUrl ? (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-50/60 border border-blue-200">
          <div className="flex items-center gap-3 min-w-0">
            {isPdf ? (
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            ) : (
              <img
                src={effectiveUrl}
                alt="Uploaded document"
                className="w-10 h-10 rounded-xl object-cover border border-blue-200 shrink-0"
              />
            )}
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-900 block truncate">
                {fileName || 'Uploaded Document'}
              </span>
              <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Uploaded to S3 Storage
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={effectiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-600 transition"
              title="Preview Document"
            >
              <Eye className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              title="Remove File"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : uploading ? (
        <div className="p-4 rounded-2xl bg-slate-50 border border-blue-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Uploading {fileName}...</span>
            <span className="font-mono font-bold text-blue-700">{progress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-sky-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <div>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/30 rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5 group"
          >
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition">
              <UploadCloud className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">
              Click to select or drag document
            </span>
            <span className="text-[10px] text-slate-400">
              {description || 'PNG, JPG, WEBP or PDF up to 10MB'}
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-rose-600 text-[11px] font-semibold pt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
