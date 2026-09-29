import React, { useState, useEffect, useRef } from 'react';
import { User, Role, Order } from '../types';
import { isUserInGroup } from '../services/api';
import { Box, Bell, Info } from 'lucide-react';

interface HeaderProps {
  user: User;
  role: Role;
  activeView: string;
  setActiveView: (view: string) => void;
  orders: Order[];
  onLogout: () => void;
  onSelectOrderFromNotif: (orderId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  role,
  activeView,
  setActiveView,
  orders,
  onLogout,
  onSelectOrderFromNotif
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isServer = role === 'server';
  const myArea = String(user.phone).toLowerCase();

  // Find incoming transfers for user's area
  const pendingTransfers: Order[] = [];
  if (!isServer && user) {
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      if (!o || !o.customer || o.customer.name !== 'INTERNAL_TRANSFER') continue;

      const status = o.status ? o.status.trim().toLowerCase() : '';
      if (status === 'diterima' || status === 'selesai' || status === 'disimpan') continue;

      const target = String(o.customer.address).toLowerCase();
      if (isUserInGroup(myArea, target)) {
        pendingTransfers.push(o);
      }
    }
  }

  const notifCount = pendingTransfers.length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotifClick = (orderId: string) => {
    setNotifOpen(false);
    onSelectOrderFromNotif(orderId);
  };

  return (
    <header className="mb-8 bg-white p-5 rounded-3xl shadow-sm border border-slate-100 sticky top-4 z-40">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
            <Box className="w-8 h-8 text-orange-500" />
            GUDANG GLOBAL MART
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium bg-slate-100 inline-block px-2.5 py-1 rounded-md">
            {role === 'gudang' ? (
              <span className="font-bold text-slate-700">
                Area / Posisi: {user.phone && user.phone !== user.name ? `${user.phone} (${user.name})` : user.phone || user.name}
              </span>
            ) : (
              <span className="font-bold text-slate-700">
                Akses: Super Admin ({user.phone || user.name})
              </span>
            )}
          </p>
        </div>

        {/* Nav Buttons & Notifications */}
        <div className="flex items-center w-full lg:w-auto justify-between lg:justify-end border-t border-slate-50 lg:border-t-0 pt-3 lg:pt-0 mt-3 lg:mt-0">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
            <button
              onClick={() => setActiveView('katalog')}
              className={`whitespace-nowrap px-4 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-colors cursor-pointer ${
                activeView === 'katalog' ? 'bg-blue-600 text-white shadow-md' : 'bg-transparent text-slate-600 hover:bg-slate-50'
              }`}
            >
              Katalog & Transfer
            </button>

            <button
              onClick={() => setActiveView('gudang')}
              className={`whitespace-nowrap px-4 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-colors cursor-pointer ${
                activeView === 'gudang' ? 'bg-blue-600 text-white shadow-md' : 'bg-transparent text-slate-600 hover:bg-slate-50'
              }`}
            >
              Riwayat Transfer
            </button>

            <button
              onClick={() => setActiveView('riwayat-sku')}
              className={`whitespace-nowrap px-4 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-colors cursor-pointer ${
                activeView === 'riwayat-sku' ? 'bg-blue-600 text-white shadow-md' : 'bg-transparent text-slate-600 hover:bg-slate-50'
              }`}
            >
              Riwayat by SKU
            </button>

            {role === 'server' && (
              <button
                onClick={() => setActiveView('upload-gambar')}
                className={`whitespace-nowrap px-4 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-colors ${
                  activeView === 'upload-gambar' ? 'bg-blue-600 text-white shadow-md' : 'bg-transparent text-slate-600 hover:bg-slate-50'
                }`}
              >
                Upload Gambar Server
              </button>
            )}
          </div>

          {/* Notifikasi & Keluar */}
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3 ml-2 shrink-0">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2.5 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-blue-600 rounded-xl transition-colors cursor-pointer"
              >
                <Bell className="w-5 h-5" />
                {notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full shadow-sm border-2 border-white">
                    {notifCount}
                  </span>
                )}
              </button>

              {/* Dropdown Notif */}
              {notifOpen && (
                <div className="absolute right-0 mt-3 w-[300px] sm:w-[350px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 transform origin-top-right transition-all">
                  <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
                    <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-500" />
                      Kotak Masuk
                    </h4>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                      {notifCount} Baru
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar p-2 divide-y divide-slate-50">
                    {pendingTransfers.length > 0 ? (
                      pendingTransfers.map((po) => {
                        const sender = po.customer.phone;
                        const senderName = po.note ? po.note.split('-')[0].trim() : 'Gudang';
                        let safeItems: any[] = [];
                        if (Array.isArray(po.items)) safeItems = po.items;
                        else if (typeof po.items === 'string') {
                          try {
                            safeItems = JSON.parse(po.items);
                          } catch (e) {}
                        }

                        const itemSummary =
                          safeItems.length > 0
                            ? `${safeItems[0].qty}x ${safeItems[0].name}${safeItems.length > 1 ? ` (+${safeItems.length - 1} brg lain)` : ''}`
                            : 'Barang';

                        return (
                          <div
                            key={po.id}
                            className="p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors"
                            onClick={() => handleNotifClick(po.id)}
                          >
                            <div className="flex gap-3">
                              <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                                <Box className="w-4 h-4" />
                              </div>
                              <div>
                                <h5 className="text-xs font-bold text-slate-800 leading-tight">
                                  Dari {senderName} ({sender})
                                </h5>
                                <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{itemSummary}</p>
                                <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mt-1">
                                  {po.date}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-slate-400">
                        <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-medium">Semua kiriman sudah diterima.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onLogout}
              className="whitespace-nowrap px-4 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
            >
              Keluar
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
