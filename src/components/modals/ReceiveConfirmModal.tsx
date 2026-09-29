import React, { useState, useEffect } from 'react';
import { User, Order, OrderItem } from '../../types';
import { fetchGAS, resizeImageFile } from '../../services/api';
import { X } from 'lucide-react';

interface ReceiveConfirmModalProps {
  isOpen: boolean;
  orderIds: string[];
  orders: Order[];
  user: User;
  onClose: () => void;
  onSuccess: () => void;
  showAlert: (type: 'success' | 'warning', title: string, message: string) => void;
}

interface RecvItemState {
  orderId: string;
  itemIdx: number;
  sku: string;
  name: string;
  unit: string;
  sentQty: number;
  sentTotal: number;
  recvQty: number;
  recvTotal: number;
}

export const ReceiveConfirmModal: React.FC<ReceiveConfirmModalProps> = ({
  isOpen,
  orderIds,
  orders,
  user,
  onClose,
  onSuccess,
  showAlert
}) => {
  const [itemStates, setItemStates] = useState<RecvItemState[]>([]);
  const [selectedProofFiles, setSelectedProofFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [btnText, setBtnText] = useState('KONFIRMASI');

  useEffect(() => {
    if (isOpen && orderIds.length > 0) {
      const initialStates: RecvItemState[] = [];
      orderIds.forEach((id) => {
        const o = orders.find((ord) => String(ord.id) === String(id));
        if (!o) return;

        let safeItems: OrderItem[] = [];
        if (Array.isArray(o.items)) safeItems = o.items;
        else if (typeof o.items === 'string') {
          try {
            safeItems = JSON.parse(o.items);
          } catch (e) {}
        }

        safeItems.forEach((item, itemIdx) => {
          const sentQty = item.qty || 0;
          const sentTotal = item.totalQty || sentQty;
          initialStates.push({
            orderId: id,
            itemIdx,
            sku: item.sku || '-',
            name: item.name || '-',
            unit: item.unit || 'pcs',
            sentQty,
            sentTotal,
            recvQty: sentQty,
            recvTotal: sentTotal
          });
        });
      });
      setItemStates(initialStates);
      setSelectedProofFiles([]);
    }
  }, [isOpen, orderIds, orders]);

  if (!isOpen) return null;

  const updateItemQty = (idx: number, field: 'recvQty' | 'recvTotal', val: number) => {
    setItemStates((prev) => {
      const up = [...prev];
      up[idx] = { ...up[idx], [field]: isNaN(val) ? 0 : val };
      return up;
    });
  };

  const handleSubmit = async () => {
    for (let i = 0; i < itemStates.length; i++) {
      if (itemStates[i].recvQty < 0 || itemStates[i].recvTotal < 0) {
        showAlert('warning', 'Validasi', 'Mohon lengkapi semua Qty dan Total Qty yang diterima pada daftar pop-up.');
        return;
      }
    }

    setIsSubmitting(true);
    setBtnText('MENGUNGGAH BUKTI...');

    try {
      // 1. Upload proof files sequentially
      const validUrls: string[] = [];
      for (let i = 0; i < selectedProofFiles.length; i++) {
        setBtnText(`MENGUNGGAH BUKTI (${i + 1}/${selectedProofFiles.length})...`);
        const file = selectedProofFiles[i];
        try {
          const { mimeType, base64 } = await resizeImageFile(file, 600);
          const upRes = await fetchGAS({
            action: 'upload_image',
            filename: `Terima_Massal_${Date.now()}_${i}.png`,
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
          console.error('Error uploading receive proof:', e);
        }
      }

      setBtnText('MENYIMPAN...');

      // 2. Group received items by Order ID
      const groupedByOrder: Record<string, any[]> = {};
      itemStates.forEach((st) => {
        if (!groupedByOrder[st.orderId]) groupedByOrder[st.orderId] = [];
        groupedByOrder[st.orderId].push({
          sku: st.sku,
          qty: st.recvQty,
          totalQty: st.recvTotal
        });
      });

      const promises: Promise<any>[] = [];
      const receiverInfoName = user ? user.name : 'Gudang';

      for (const orderId in groupedByOrder) {
        const o = orders.find((ord) => String(ord.id) === String(orderId));
        if (!o) continue;

        let existingLaporan: any[] = [];
        if (o.laporanUrl) {
          try {
            const parsed = JSON.parse(o.laporanUrl);
            existingLaporan = Array.isArray(parsed) ? parsed : [{ area: 'Pengirim', url: o.laporanUrl }];
          } catch (e) {
            existingLaporan = [{ area: 'Pengirim', url: o.laporanUrl }];
          }
        }

        validUrls.forEach((url) => {
          existingLaporan.push({ area: user.phone, url });
        });

        const rInfoStr = JSON.stringify({
          name: receiverInfoName,
          items: groupedByOrder[orderId]
        });

        const req = fetchGAS({
          action: 'update_order',
          id: orderId,
          date: o.date,
          customer: typeof o.customer === 'string' ? o.customer : JSON.stringify(o.customer),
          items: typeof o.items === 'string' ? o.items : JSON.stringify(o.items),
          totalAmount: o.totalAmount || 0,
          status: 'Diterima',
          note: o.note,
          gudangInfo: rInfoStr,
          laporanUrl: JSON.stringify(existingLaporan)
        });

        promises.push(req);
      }

      await Promise.all(promises);

      onClose();
      showAlert('success', 'Berhasil', 'Semua barang yang dipilih telah dikonfirmasi.');
      onSuccess();
    } catch (err: any) {
      showAlert('warning', 'Galat', 'Terjadi kesalahan saat memproses data. ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
      setBtnText('KONFIRMASI');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="mb-4 pb-4 border-b border-slate-100 flex justify-between items-start shrink-0">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Terima Barang</h3>
            <p className="text-xs font-medium text-slate-500 mt-1">Verifikasi Qty barang dan unggah bukti foto.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
          {itemStates.map((st, idx) => (
            <div
              key={`${st.orderId}-${st.itemIdx}`}
              className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
              <div className="flex justify-between items-start mb-3 pl-2">
                <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{st.sku}</div>
                  <div className="text-sm font-bold text-slate-800 line-clamp-1 mt-0.5">{st.name}</div>
                  <div className="text-[9px] font-medium text-blue-500 mt-0.5">Dari ID: {st.orderId}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Dikirim (TF)</div>
                  <div className="text-sm font-black text-blue-700">
                    {st.sentQty} {st.unit}
                  </div>
                  {st.sentTotal !== st.sentQty && (
                    <div className="text-[9px] text-blue-400 mt-0.5">(Total: {st.sentTotal})</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200 pl-2">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Qty Diterima*
                  </label>
                  <input
                    type="number"
                    value={st.recvQty}
                    onChange={(e) => updateItemQty(idx, 'recvQty', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-black text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none text-center shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Total Diterima*
                  </label>
                  <input
                    type="number"
                    value={st.recvTotal}
                    onChange={(e) => updateItemQty(idx, 'recvTotal', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-black text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none text-center shadow-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-5 pt-4 border-t border-slate-100 shrink-0">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Upload Foto Bukti (Opsional, Bisa &gt;1 Foto, Maks 2MB/foto)
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              if (e.target.files) setSelectedProofFiles(Array.from(e.target.files));
            }}
            className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100 border border-slate-200 rounded-2xl p-1.5 cursor-pointer bg-slate-50 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-100 text-slate-700 py-3.5 rounded-xl font-bold hover:bg-slate-200 transition-colors text-xs uppercase tracking-widest cursor-pointer"
          >
            Batal
          </button>
          <button
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="flex-1 bg-orange-500 text-white py-3.5 rounded-xl font-black shadow-md hover:bg-orange-600 transition-colors text-xs flex justify-center items-center gap-2 uppercase tracking-widest cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <span>{btnText}</span>
            {isSubmitting && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
