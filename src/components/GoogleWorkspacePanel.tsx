import React, { useState, useEffect } from 'react';
import { googleSignIn, googleLogout, initGoogleAuth } from '../services/googleAuth';
import { listDriveSpreadsheets, getSpreadsheetValues, createSpreadsheet, DriveFileItem } from '../services/googleWorkspace';
import { User as FirebaseUser } from 'firebase/auth';
import { FileSpreadsheet, RefreshCw, Plus, ExternalLink, CheckCircle, LogOut } from 'lucide-react';

interface GoogleWorkspacePanelProps {
  showAlert: (type: 'success' | 'warning', title: string, message: string) => void;
  onSelectDriveSpreadsheet?: (file: DriveFileItem) => void;
}

export const GoogleWorkspacePanel: React.FC<GoogleWorkspacePanelProps> = ({
  showAlert,
  onSelectDriveSpreadsheet
}) => {
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<DriveFileItem | null>(null);
  const [previewData, setPreviewData] = useState<any[][]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [newSheetTitle, setNewSheetTitle] = useState('');
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (u, accessToken) => {
        setGoogleUser(u);
        setToken(accessToken);
      },
      () => {
        setGoogleUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setToken(result.accessToken);
        showAlert('success', 'Google Connected', `Berhasil masuk sebagai ${result.user.displayName || result.user.email}`);
        fetchDriveFiles();
      }
    } catch (err: any) {
      console.error('Login Google failed:', err);
      showAlert('warning', 'Google Sign-In Gagal', err.message || 'Gagal masuk dengan Google.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await googleLogout();
    setGoogleUser(null);
    setToken(null);
    setDriveFiles([]);
    setSelectedFile(null);
    setPreviewData([]);
    showAlert('success', 'Google Out', 'Akun Google telah terlepas.');
  };

  const fetchDriveFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const files = await listDriveSpreadsheets();
      setDriveFiles(files);
    } catch (err: any) {
      showAlert('warning', 'Drive API Error', err.message || 'Gagal mengambil file Google Sheets.');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handlePreviewSheet = async (file: DriveFileItem) => {
    setSelectedFile(file);
    setIsLoadingPreview(true);
    try {
      const values = await getSpreadsheetValues(file.id, 'A1:Z20');
      setPreviewData(values);
      if (onSelectDriveSpreadsheet) {
        onSelectDriveSpreadsheet(file);
      }
    } catch (err: any) {
      showAlert('warning', 'Preview Gagal', err.message || 'Gagal membaca data spreadsheet.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleCreateNewSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSheetTitle.trim()) return;

    setIsCreatingSheet(true);
    try {
      const created = await createSpreadsheet(newSheetTitle.trim());
      showAlert('success', 'Spreadsheet Dibuat', `File "${newSheetTitle}" berhasil dibuat di Google Drive Anda.`);
      setNewSheetTitle('');
      fetchDriveFiles();
      window.open(created.webViewLink, '_blank');
    } catch (err: any) {
      showAlert('warning', 'Gagal Membuat Sheet', err.message || 'Terjadi kesalahan saat membuat file.');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            Integrasi Google Drive & Google Sheets
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Hubungkan akun Google Workspace Anda untuk membaca dan mengelola file spreadsheet langsung dari Google Drive.
          </p>
        </div>

        {googleUser ? (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-2xl">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-800 line-clamp-1">{googleUser.displayName || 'Google Account'}</p>
              <p className="text-[10px] text-emerald-700 font-mono line-clamp-1">{googleUser.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-rose-600 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
              title="Keluar Akun Google"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="gsi-material-button font-bold text-xs bg-white border border-slate-300 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-all shadow-sm cursor-pointer disabled:opacity-70"
          >
            <div className="gsi-material-button-icon w-5 h-5 flex-shrink-0">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
            </div>
            <span className="gsi-material-button-contents font-black text-slate-700">
              {isSigningIn ? 'Menghubungkan...' : 'Sign in with Google'}
            </span>
          </button>
        )}
      </div>

      {googleUser && token ? (
        <div className="space-y-6">
          {/* Create New Sheet Form */}
          <form onSubmit={handleCreateNewSheet} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Buat Spreadsheet Baru di Google Drive
              </label>
              <input
                type="text"
                value={newSheetTitle}
                onChange={(e) => setNewSheetTitle(e.target.value)}
                placeholder="Contoh: Stok Gudang Global Mart 2026"
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={isCreatingSheet || !newSheetTitle.trim()}
              className="bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreatingSheet ? 'Membuat...' : 'Buat Sheet'}</span>
            </button>
          </form>

          {/* List Files from Drive */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Daftar File Google Sheets di Drive Anda
              </h3>
              <button
                onClick={fetchDriveFiles}
                className="text-[10px] bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {isLoadingFiles ? (
              <div className="py-8 text-center text-xs font-bold text-slate-400 uppercase tracking-wider animate-pulse">
                Memuat daftar file dari Google Drive...
              </div>
            ) : driveFiles.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs font-medium border border-slate-100 rounded-2xl bg-slate-50">
                Tidak ditemukan file Google Sheets di Drive Anda.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {driveFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => handlePreviewSheet(file)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex justify-between items-center ${
                      selectedFile?.id === file.id
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-emerald-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate pr-2">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-800 truncate">{file.name}</p>
                        <p className="text-[9px] font-mono text-slate-400">ID: {file.id.substring(0, 12)}...</p>
                      </div>
                    </div>
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50"
                        title="Buka di Tab Baru"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview Sheet Data */}
          {selectedFile && (
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  Pratinjau Spreadsheet: <span className="text-emerald-700">{selectedFile.name}</span>
                </h4>
              </div>

              {isLoadingPreview ? (
                <div className="py-6 text-center text-xs font-bold text-slate-400 animate-pulse">
                  Membaca data dari Google Sheets API...
                </div>
              ) : previewData.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4">Data sheet kosong atau tidak dapat diakses.</div>
              ) : (
                <div className="overflow-x-auto max-h-60 custom-scrollbar border border-slate-200 rounded-xl bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-[9px] font-black uppercase text-slate-500 tracking-wider sticky top-0">
                      <tr>
                        {previewData[0]?.map((cell: any, idx: number) => (
                          <th key={idx} className="p-2.5 border-b border-slate-200 border-r last:border-r-0 whitespace-nowrap">
                            {String(cell || '')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700 text-[11px]">
                      {previewData.slice(1).map((row: any[], rIdx: number) => (
                        <tr key={rIdx} className="hover:bg-slate-50">
                          {previewData[0]?.map((_: any, cIdx: number) => (
                            <td key={cIdx} className="p-2.5 border-r last:border-r-0 whitespace-nowrap">
                              {row[cIdx] !== undefined ? String(row[cIdx]) : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-xs">
          Klik tombol <strong>"Sign in with Google"</strong> di atas untuk mengaktifkan akses Google Workspace (Drive & Sheets).
        </div>
      )}
    </div>
  );
};
