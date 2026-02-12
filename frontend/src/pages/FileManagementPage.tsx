/**
 * File Management Page
 * Allows creators to view, upload, and delete files
 * Displays storage quota usage
 */

import React, { useState, useEffect } from 'react';
import { Trash2, Upload, File, Film, Mic, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface FileItem {
  id: string;
  name: string;
  type: 'voice' | 'video';
  fileUrl: string;
  sizeMB: string;
  sizeBytes: number;
  uploadedAt: string;
}

interface StorageUsage {
  planTier: string;
  quotaMB: number;
  usedMB: number;
  remainingMB: number;
  percentageUsed: number;
}

export default function FileManagementPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFiles();
    fetchStorageUsage();
  }, []);

  async function fetchFiles() {
    try {
      const response = await fetch('/api/creator/files', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const data = await response.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error('Fetch files error:', error);
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  }

  async function fetchStorageUsage() {
    try {
      const response = await fetch('/api/creator/storage', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch storage usage');
      }

      const data = await response.json();
      setStorageUsage(data);
    } catch (error) {
      console.error('Fetch storage error:', error);
    }
  }

  async function handleDelete(fileId: string, fileType: 'voice' | 'video') {
    if (!confirm('Delete this file? This cannot be undone.')) return;

    try {
      const response = await fetch(`/api/creator/files/${fileId}?type=${fileType}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete file');
      }

      const data = await response.json();
      toast.success(`File deleted. ${data.storageFreed}MB freed.`);

      // Refresh lists
      await fetchFiles();
      await fetchStorageUsage();

    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Failed to delete file');
    }
  }

  function getFileIcon(type: string) {
    switch (type) {
      case 'voice':
        return <Mic className="w-5 h-5 text-purple-600" />;
      case 'video':
        return <Film className="w-5 h-5 text-blue-600" />;
      default:
        return <File className="w-5 h-5 text-gray-600" />;
    }
  }

  function getStorageColor(percentage: number) {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-blue-500';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading files...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">File Management</h1>

      {/* Storage Overview */}
      {storageUsage && (
        <div className="bg-white border rounded-lg p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg">Storage Usage</h3>
            <span className="text-sm text-gray-600">
              {storageUsage.usedMB.toFixed(2)} / {storageUsage.quotaMB} MB
            </span>
          </div>

          {/* Progress Bar */}
          <div className="bg-gray-200 rounded-full h-3 mb-3">
            <div
              className={`h-3 rounded-full transition-all ${getStorageColor(storageUsage.percentageUsed)}`}
              style={{ width: `${Math.min(storageUsage.percentageUsed, 100)}%` }}
            />
          </div>

          {/* Plan Info */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Plan: <span className="font-medium capitalize">{storageUsage.planTier}</span>
            </span>
            <span className="text-gray-600">
              {storageUsage.remainingMB.toFixed(2)} MB remaining
            </span>
          </div>

          {/* Warning Messages */}
          {storageUsage.percentageUsed >= 90 && (
            <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-3 rounded">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-red-800 font-medium">
                    Storage almost full
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    Delete unused files or upgrade your plan to avoid upload failures.
                  </p>
                </div>
              </div>
            </div>
          )}

          {storageUsage.percentageUsed >= 80 && storageUsage.percentageUsed < 90 && (
            <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-yellow-800 font-medium">
                    Storage running low
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Consider deleting old files or upgrading your plan.
                  </p>
                </div>
              </div>
            </div>
          )}

          {storageUsage.percentageUsed >= 100 && (
            <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-3 rounded">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-red-800 font-medium">
                    Storage full
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    Cannot upload new files. Delete files before uploading.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* File List */}
      <div className="bg-white border rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold text-lg">Your Files ({files.length})</h3>
        </div>

        <div className="p-6">
          {files.length === 0 ? (
            <div className="text-center py-12">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No files uploaded yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Upload voice clones and video avatars to get started
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getFileIcon(file.type)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {file.sizeMB} MB • Uploaded {file.uploadedAt} • {file.type === 'voice' ? 'Voice Clone' : 'Video Avatar'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(file.id, file.type)}
                    className="ml-4 text-red-600 hover:text-red-800 transition-colors p-2 hover:bg-red-50 rounded flex-shrink-0"
                    title="Delete file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>💡 Tip:</strong> Upload files through the Voice and Video sections.
          Files are automatically tracked against your storage quota.
        </p>
      </div>
    </div>
  );
}
