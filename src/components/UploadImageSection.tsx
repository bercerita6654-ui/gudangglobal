import React, { useState } from 'react';
import { fetchGAS, resizeImageFile, getDriveId } from '../services/api';
import { Upload } from 'lucide-react';

interface UploadImageSectionProps {
  onUploadSuccess: () => void;
  showAlert: (type: 'success' | 'warning', title: string, message: string) => void;
}

interface UploadedImageItem {
  sku: string;
  url: string;
  driveId?: string;
  timestamp: string;
}

export const UploadImageSection: React.FC<UploadImageSectionProps> = ({
  onUploadSuccess,
  showAlert
}) => {
  const [skuInput, setSkuInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedList, setUploadedList] = useState<UploadedImageItem[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewSrc(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedFile(null);
      setPreviewSrc(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skuInput.trim() || !selectedFile) {
      showAlert('warning', 'Validasi', 'Mohon isi SKU dan pilih gambar terlebih dahulu.');
      return;
    }

    let sku = skuInput.trim();
    if (/^\d{1,4}$/.test(sku)) sku = sku.padStart(5, '0');

    setIsUploading(true);

    try {
      const { mimeType, base64 } = await resizeImageFile(selectedFile, 600);

      const payload = {
        action: 'upload_image',
        filename: `${sku}.png`,
        mimeType,
        base64,
        data: base64,
        file: base64
      };

      const res = await fetchGAS(payload);

      const returnedUrl =
        res?.url || res?.fileUrl || res?.link || (typeof res?.data === 'string' ? res.data : null);
      const returnedDriveId = res?.driveId || res?.id || (returnedUrl ? getDriveId(returnedUrl) : null);

      const displayImgUrl = returnedDriveId
        ? `https://drive.google.com/thumbnail?id=${returnedDriveId}&sz=w500`
        : returnedUrl || previewSrc || '';

      if (res && (res.status === 'success' || res.result === 'success' || returnedUrl || returnedDriveId)) {
        showAlert('success', 'Upload Berhasil', `Gambar untuk SKU ${sku} berhasil di-upload dan tersimpan di server.`);

        if (displayImgUrl) {
          setUploadedList((prev) => [
            {
              sku,
              url: displayImgUrl,
              driveId: returnedDriveId || undefined,
              timestamp: new Date().toLocaleTimeString('id-ID')
            },
            ...prev
          ]);
        }

        setSkuInput('');
        setSelectedFile(null);
        setPreviewSrc(null);
        onUploadSuccess();
      } else {
        showAlert('warning', 'Upload Gagal', `Server merespon: ${res ? res.message || JSON.stringify(res) : 'Tidak ada respon'}`);
      }
    } catch (err: any) {
      showAlert('warning', 'Koneksi Error', `Error dari server: ${err.message || String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 max-w-2xl mx-auto">
      <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 mb-6 border-b border-slate-50 pb-4">
        <Upload className="w-6 h-6 text-blue-600" />
        Upload Gambar ke Server
      </h2>
      <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
        Fitur ini memungkinkan Server mengunggah gambar langsung ke database Google Drive. Gambar akan otomatis di-resize menjadi 600x600. Masukkan 5 digit SKU yang tepat.
      </p>

      <form onSubmit={handleUpload} className="space-y-5">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            SKU Produk (Wajib)
          </label>
          <input
            type="text"
            value={skuInput}
            onChange={(e) => setSkuInput(e.target.value)}
            required
            placeholder="Contoh: 01570"
            className="w-full p-4 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600 text-sm font-medium transition-all bg-slate-50 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Pilih File Gambar (Maks 2MB)
          </label>
          <input
            type="file"
            accept="image/*"
            required
            onChange={handleFileChange}
            className="w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all border border-slate-200 rounded-2xl p-2 bg-slate-50 cursor-pointer"
          />
        </div>

        {previewSrc && (
          <div className="mt-4 bg-slate-100 rounded-2xl p-2 border border-slate-200 flex justify-center items-center h-48 overflow-hidden relative">
            <img src={previewSrc} alt="Preview" className="max-h-full object-contain rounded-xl shadow-sm" />
          </div>
        )}

        <button
          type="submit"
          disabled={isUploading}
          className="w-full bg-slate-900 hover:bg-blue-600 text-white font-bold py-4 rounded-xl transition-colors shadow-lg flex justify-center items-center gap-2 text-sm tracking-wide mt-4 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <span>{isUploading ? 'MENGUPLOAD...' : 'MULAI UPLOAD'}</span>
          {isUploading && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          )}
        </button>
      </form>

      {uploadedList.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-100">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">
            Gambar Yang Baru Saja Diupload ({uploadedList.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {uploadedList.map((item, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200 p-2 rounded-2xl flex flex-col items-center">
                <div className="w-full aspect-square bg-white rounded-xl overflow-hidden mb-2 border border-slate-100 flex items-center justify-center p-1">
                  <img
                    src={item.url}
                    alt={item.sku}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (item.driveId && !target.dataset.retry) {
                        target.dataset.retry = '1';
                        target.src = `https://drive.google.com/uc?export=view&id=${item.driveId}`;
                      }
                    }}
                  />
                </div>
                <div className="text-[10px] font-black text-orange-600 uppercase">SKU: {item.sku}</div>
                <div className="text-[8px] font-medium text-slate-400 mt-0.5">{item.timestamp}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
