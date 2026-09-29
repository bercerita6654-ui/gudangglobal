import React, { useState, useEffect } from 'react';
import { User, Order, OrderItem, Role } from '../../types';
import { fetchGAS } from '../../services/api';
import { X } from 'lucide-react';

interface EditOrderModalProps {
  orderId: string | null;
  orders: Order[];
  user: User;
  role?: Role;
  onClose: () => void;
  onSuccess: () => void;
  showAlert: (type: 'success' | 'warning', title: string, message: string) => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  orderId,
  orders,
  user,
  role = 'gudang',
  onClose,
  onSuccess,
  showAlert
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState('Sedang Dikirim');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (orderId) {
      const o = orders.find((ord) => ord.id === orderId);
      if (o) {
        setOrder(o);
        setStatus(o.status || 'Sedang Dikirim');

        let trueNote = '';
        if (o.note) {
          if (o.note.indexOf('- Catatan:') > -1) {
            trueNote = o.note.split('- Catatan:')[1].trim();
          } else if (o.note.indexOf('-') > -1) {
            trueNote = o.note.split('-').slice(1).join('-').trim();
          }
        }
        setNote(trueNote);

        let safeItems: OrderItem[] = [];
        if (Array.isArray(o.items)) safeItems = o.items;
        else if (typeof o.items === 'string') {
          try {
            safeItems = JSON.parse(o.items);
          } catch (e) {}
        }
        setItems(safeItems);
      }
    }
  }, [orderId, orders]);

  if (!orderId || !order) return null;

  const handleQtyChange = (index: number, newQty: number) => {
    setItems((prev) => {
      const up = [...prev];
      up[index] = { ...up[index], qty: newQty, totalQty: newQty };
      return up;
    });
  };

  const handleSubmit = async () => {
    if (order && user) {
      const isServer = role === 'server';
      const currentUserName = (user.name || '').toLowerCase().trim();
      const orderNote = (order.note || '').toLowerCase().trim();

      let isOwner = isServer;

      if (!isServer && currentUserName && currentUserName.length >= 2) {
        if (orderNote.includes(currentUserName)) {
          isOwner = true;
        }
      }

      if (!isOwner) {
        showAlert(
          'warning',
          'Akses Ditolak',
          'akun anda tidak bisa merubah data akun lain, anda hanya bisa mengubah akun input anda sendiri'
        );
        onClose();
        return;
      }
    }

    setIsSaving(true);
    try {
      const senderName = order.note ? order.note.split('-')[0].trim() : user ? user.name : 'Gudang';
      const finalNote = senderName + (note ? ' - Catatan: ' + note : '');

      const res = await fetchGAS({
        action: 'update_order',
        id: order.id,
        date: order.date,
        customer: typeof order.customer === 'string' ? order.customer : JSON.stringify(order.customer),
        items: JSON.stringify(items),
        totalAmount: order.totalAmount || 0,
        status,
        note: finalNote,
        gudangInfo: order.gudangInfo || '',
        laporanUrl: order.laporanUrl || ''
      });

      if (res && (res.status === 'success' || res.result === 'success')) {
        showAlert('success', 'Berhasil', 'Transaksi berhasil diperbarui.');
        onClose();
        onSuccess();
      } else {
        showAlert('warning', 'Gagal', 'Respon server: ' + JSON.stringify(res));
      }
    } catch (err: any) {
      showAlert('warning', 'Error', 'Gagal menghubungi server. ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Edit Transaksi</h3>
            <p className="text-xs font-bold text-blue-600 mt-0.5">{order.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Status Pengiriman
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="Sedang Dikirim">Sedang Dikirim</option>
              <option value="Diterima">Diterima</option>
              <option value="Selesai">Selesai</option>
              <option value="Disimpan">Disimpan</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Catatan / Keterangan
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 border-b border-slate-100 pb-1">
              Edit Jumlah Barang (Qty TF)
            </label>
            <div className="mt-2 space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-700 truncate pr-2 flex-1">
                    {it.sku || '-'} : {it.name || ''}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Qty TF</label>
                    <input
                      type="number"
                      value={it.qty}
                      onChange={(e) => handleQtyChange(idx, parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-black text-center outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
          <button
            onClick={onClose}
            className="w-1/3 bg-white text-slate-600 border border-slate-200 font-bold py-3 rounded-xl text-xs hover:bg-slate-50 transition-colors uppercase cursor-pointer"
          >
            Batal
          </button>
          <button
            disabled={isSaving}
            onClick={handleSubmit}
            className="w-2/3 bg-blue-600 text-white font-bold py-3 rounded-xl text-xs hover:bg-blue-700 shadow-md transition-colors uppercase tracking-widest cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            <span>{isSaving ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
