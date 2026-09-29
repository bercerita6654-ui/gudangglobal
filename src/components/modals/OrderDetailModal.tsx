import React, { useState } from 'react';
import { User, Role, Order, OrderItem } from '../../types';
import { isUserInGroup, fetchGAS, resizeImageFile, parseLaporanUrls } from '../../services/api';
import { X, User as UserIcon, MapPin, Edit, ZoomIn } from 'lucide-react';

interface OrderDetailModalProps {
  order: Order | null;
  user: User;
  role: Role;
  onClose: () => void;
  onSuccess: () => void;
  openImageZoom: (src: string, driveId?: string) => void;
  showAlert: (type: 'success' | 'warning', title: string, message: string) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  user,
  role,
  onClose,
  onSuccess,
  openImageZoom,
  showAlert
}) => {
  const [susulanFiles, setSusulanFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  if (!order) return null;

  let safeItems: OrderItem[] = [];
  if (Array.isArray(order.items)) safeItems = order.items;
  else if (typeof order.items === 'string') {
    try {
      safeItems = JSON.parse(order.items);
    } catch (e) {}
  }

  const trueNote =
    order.note && order.note.indexOf('- Catatan:') > -1
      ? order.note.split('- Catatan:')[1].trim()
      : '';

  const isServer = role === 'server';
  const myArea = user ? String(user.phone).toLowerCase() : '';
  const targetArea = String(order.customer.address).toLowerCase();
  const senderArea = String(order.customer.phone).toLowerCase();

  const canUploadSusulan =
    isServer || isUserInGroup(myArea, targetArea) || isUserInGroup(myArea, senderArea);

  const handleUploadSusulan = async () => {
    if (susulanFiles.length === 0) {
      showAlert('warning', 'Validasi', 'Silakan pilih foto terlebih dahulu.');
      return;
    }

    setIsUploading(true);

    try {
      const validUrls: string[] = [];
      for (let i = 0; i < susulanFiles.length; i++) {
        const file = susulanFiles[i];
        try {
          const { mimeType, base64 } = await resizeImageFile(file, 600);
          const upRes = await fetchGAS({
            action: 'upload_image',
            filename: `Bukti_Susulan_${Date.now()}_${i}.png`,
            mimeType,
            base64,
            data: base64,
            file: base64
          });

          if (upRes) {
            const returnedUrl = upRes.url || upRes.fileUrl || upRes.link || (typeof upRes.data === 'string' ? upRes.data : null);
            if (returnedUrl) {
              validUrls.push(returnedUrl);
            } else if (upRes.status === 'success' || upRes.result === 'success') {
              validUrls.push('https://drive.google.com/file/d/upload_success/view');
            }
          }
        } catch (e) {
          console.error('Error uploading susulan:', e);
        }
      }

      if (validUrls.length === 0) {
        showAlert('warning', 'Gagal', 'Gagal mengunggah foto laporan ke server.');
        setIsUploading(false);
        return;
      }

      let existingLaporan = parseLaporanUrls(order.laporanUrl);
      validUrls.forEach((url) => {
        existingLaporan.push({ area: user.phone, url });
      });

      await fetchGAS({
        action: 'update_order',
        id: order.id,
        date: order.date,
        customer: typeof order.customer === 'string' ? order.customer : JSON.stringify(order.customer),
        items: typeof order.items === 'string' ? order.items : JSON.stringify(order.items),
        totalAmount: order.totalAmount || 0,
        status: order.status,
        note: order.note,
        gudangInfo: order.gudangInfo || '',
        laporanUrl: JSON.stringify(existingLaporan)
      });

      showAlert('success', 'Berhasil', 'Bukti foto berhasil ditambahkan ke riwayat transaksi.');
      setSusulanFiles([]);
      onClose();
      onSuccess();
    } catch (err: any) {
      showAlert('warning', 'Galat', 'Terjadi kesalahan saat menyimpan data ke spreadsheet. ' + (err.message || ''));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-[2rem] w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Rincian Transfer</h3>
            <p className="text-xs font-mono font-bold text-blue-600 mt-1">
              #{order.id} • {order.date}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white border border-slate-200 rounded-full shadow-sm hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 text-slate-700">
          <div className="grid grid-cols-1 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <UserIcon className="w-3 h-3" /> Pengirim
              </h4>
              <p className="font-bold text-slate-800 text-sm">
                {order.note ? order.note.split('- Catatan:')[0].trim() : order.customer.phone}
              </p>
              <p className="text-xs font-mono mt-1 text-slate-500">{order.customer.phone}</p>
            </div>
            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Tujuan Area
              </h4>
              <p className="text-xs font-medium leading-relaxed">{order.customer.address}</p>
            </div>
          </div>

          {trueNote && (
            <div className="bg-amber-50 border border-amber-100 p-5 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
              <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Edit className="w-3 h-3" /> Catatan Khusus
              </h4>
              <p className="text-sm text-amber-900 font-medium">{trueNote}</p>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Daftar Barang</h4>
            <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 text-[9px] uppercase font-black text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-4">Info Produk</th>
                    <th className="p-4 text-center">Dikirim (TF)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700 font-medium text-xs">
                  {safeItems.map((it, idx) => {
                    const primarySrc = it.driveId ? `https://lh3.googleusercontent.com/d/${it.driveId}` : it.img || 'https://placehold.co/300x300/f8fafc/64748b?text=Gambar';
                    return (
                      <tr key={idx}>
                        <td className="p-4 bg-white">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 flex-shrink-0 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 cursor-zoom-in relative group"
                              onClick={() => openImageZoom(primarySrc, it.driveId)}
                            >
                              <img
                                src={primarySrc}
                                alt={it.name}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  e.currentTarget.src = 'https://placehold.co/300x300/f8fafc/64748b?text=Kosong';
                                }}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              />
                              <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn className="w-3 h-3 text-white" />
                              </div>
                            </div>
                            <div>
                              <span className="font-mono text-[10px] block">{it.sku || '-'}</span>
                              <span className="font-bold text-slate-800 text-xs line-clamp-1 mt-0.5">{it.name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center font-black text-blue-600 bg-blue-50/30 whitespace-nowrap">
                          {it.qty} {it.unit || 'pcs'}
                          {it.totalQty && it.totalQty !== it.qty && (
                            <div className="text-[9px] text-slate-500 mt-1">Total: {it.totalQty}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upload Bukti Susulan hidden per user request */}
        </div>

        <div className="p-5 bg-white border-t border-slate-100 flex justify-center gap-3">
          <button
            onClick={onClose}
            className="w-full bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 font-bold py-3.5 rounded-xl text-sm transition-colors tracking-wide cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
