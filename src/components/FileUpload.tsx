"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Camera, FileText, ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export default function FileUpload({ onFileSelect, disabled }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      const name = file.name.toLowerCase();
      const allowedMime = ["application/pdf", "image/jpeg", "image/png"];
      const allowedExt = [".doc", ".docx", ".xls", ".xlsx", ".txt"];
      const extOk = allowedExt.some((ext) => name.endsWith(ext));
      if (!allowedMime.includes(file.type) && !extOk) {
        alert("対応形式: PDF, Image, Word, Excel, Text");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        alert("ファイルサイズは20MB以下にしてください");
        return;
      }
      setSelectedFile(file);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const getFileIcon = (file: File) => {
    const name = file.name.toLowerCase();
    if (file.type === "application/pdf") return <FileText className="w-8 h-8 text-red-400" />;
    if (name.endsWith(".doc") || name.endsWith(".docx")) return <FileText className="w-8 h-8 text-blue-500" />;
    if (name.endsWith(".xls") || name.endsWith(".xlsx")) return <FileText className="w-8 h-8 text-emerald-400" />;
    if (name.endsWith(".txt")) return <FileText className="w-8 h-8 text-slate-400" />;
    return <ImageIcon className="w-8 h-8 text-blue-400" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer",
          isDragging
            ? "border-blue-400 bg-blue-500/10 scale-[1.01]"
            : "border-slate-600/50 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        {selectedFile ? (
          <div className="flex flex-col items-center gap-3">
            {getFileIcon(selectedFile)}
            <div>
              <p className="text-white font-medium text-sm">{selectedFile.name}</p>
              <p className="text-slate-400 text-xs mt-0.5">{formatSize(selectedFile.size)}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
              }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition-colors"
            >
              <X className="w-3 h-3" /> 変更する
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200",
              isDragging ? "bg-blue-500/20" : "bg-slate-700/50"
            )}>
              <Upload className={cn(
                "w-7 h-7 transition-colors",
                isDragging ? "text-blue-400" : "text-slate-400"
              )} />
            </div>
            <div>
              <p className="text-slate-300 font-medium">
                ファイルをドラッグ＆ドロップ
              </p>
              <p className="text-slate-500 text-sm mt-1">
                または<span className="text-blue-400 hover:underline">クリックして選択</span>
              </p>
              <p className="text-slate-600 text-xs mt-2">PDF · Image · Word · Excel · Text（最大20MB）</p>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {/* Camera button */}
      <button
        onClick={() => !disabled && cameraInputRef.current?.click()}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600 text-slate-300 hover:text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Camera className="w-5 h-5" />
        <span className="text-sm font-medium">スマホカメラで撮影</span>
      </button>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
