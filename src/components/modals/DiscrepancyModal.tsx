import React from 'react';
import { SkuGroupData } from '../../types';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';

interface DiscrepancyModalProps {
  skuGroup: SkuGroupData | null;
  onClose: () => void;
  onOpenOrderDetail: (orderId: string) => void;
}

export const DiscrepancyModal: React.FC<DiscrepancyModalProps> = ({
  skuGroup,
  onClose,
  onOpenOrderDetail
}) => {
  if (!skuGroup) return null;

  const diff = skuGroup.qtyTf - skuGroup.qtyDiterima;
  const isKurang = diff > 0;

  const problemHistory = skuGroup.history.filter((h) => h.qtyTf !== h.qtyDiterima);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Informasi Selisih Qty</h3>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                {skuGroup.sku} - {skuGroup.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mb-5 text-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-500 font-medium">Total Dikirim (Semua)</span>
              <span className="font-black text-blue-600">{skuGroup.qtyTf}</span>
            </div>
            <div className="flex justify-between items-center mb-2 border-b border-rose-200/50 pb-2">
              <span className="text-slate-500 font-medium">Total Diterima (Semua)</span>
              <span className="font-black text-emerald-600">{skuGroup.qtyDiterima}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-700 font-bold">Total Selisih</span>
              <span className="font-black text-rose-700 text-lg">
                {isKurang ? `Kurang ${diff}` : `Lebih ${Math.abs(diff)}`}
              </span>
            </div>
          </div>

          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">
            Riwayat Transaksi Bermasalah
          </h4>

          <div className="space-y-3">
            {problemHistory.length > 0 ? (
              problemHistory.map((h) => {
                const hDiff = h.qtyTf - h.qtyDiterima;
                const hDiffText = hDiff > 0 ? `Kurang ${hDiff}` : `Lebih ${Math.abs(hDiff)}`;

                return (
                  <div key={h.id} className="bg-white border border-rose-200 rounded-xl p-3 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div
                        onClick={() => {
                          onClose();
                          onOpenOrderDetail(h.id);
                        }}
                        className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded cursor-pointer hover:underline"
                      >
                        {h.id}
                      </div>
                      <div className="text-[9px] font-bold text-slate-400">{h.date}</div>
                    </div>
                    <div className="flex items-center gap-2 mb-2 text-[10px]">
                      <span className="font-bold text-orange-600">{h.senderArea}</span>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      <span className="font-bold text-blue-600">{h.targetArea}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-2 pt-2 border-t border-slate-100">
                      <div className="text-slate-500 font-medium">
                        TF: <span className="font-black text-slate-700">{h.qtyTf}</span>, Terima:{' '}
                        <span className="font-black text-slate-700">{h.qtyDiterima}</span>
                      </div>
                      <div className="font-black text-rose-600">{hDiffText}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-slate-400 text-xs py-4">
                Data rinci selisih belum tersedia (kemungkinan selisih dari sistem lama).
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-white">
          <button
            onClick={onClose}
            className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl text-sm hover:bg-slate-800 transition-colors tracking-widest uppercase cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
