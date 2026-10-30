'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, X, FileText, AlertCircle, Eye } from 'lucide-react';
import { api } from '../lib/api';

export default function FileUploadProgress({
  label,
  description,
  fileUrl,
  onUploadComplete,
  onRemove,
  folder = 'documents',
  accept = 'image/*,application/pdf',
  required = false
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict 1MB max file size enforcement (1,048,576 bytes)
    const MAX_1MB = 1 * 1024 * 1024;
    if (file.size > MAX_1MB) {
      setError(`File size exceeds 1MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please select a file under 1MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
          onUploadComplete(res.url, res.key);
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
    onRemove();
  };

  const isPdf = fileUrl?.toLowerCase().endsWith('.pdf') || fileName.toLowerCase().endsWith('.pdf');

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs font-bold text-slate-700 block">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {fileUrl ? (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-50/60 border border-blue-200">
          <div className="flex items-center gap-3 min-w-0">
            {isPdf ? (
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            ) : (
              <img
                src={fileUrl}
                alt="Uploaded document"
                className="w-10 h-10 rounded-xl object-cover border border-blue-200 shrink-0 bg-white"
              />
            )}
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-900 block truncate">
                {fileName || 'Uploaded Document'}
              </span>
              <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Uploaded (Max 1MB verified)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition"
              title="Preview document"
            >
              <Eye className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              title="Remove document"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition ${
              uploading
                ? 'border-blue-400 bg-blue-50/40'
                : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/20'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
            />

            {uploading ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-blue-700">
                  <span>Uploading {fileName}...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <UploadCloud className="w-6 h-6 text-slate-400 mx-auto" />
                <div className="text-xs font-bold text-slate-700">
                  Click to browse or drag & drop file
                </div>
                <p className="text-[10px] text-slate-400">
                  {description || 'Supported formats: JPG, PNG, WEBP, PDF (Max 1MB)'}
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-1.5 text-xs text-rose-600 font-bold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
