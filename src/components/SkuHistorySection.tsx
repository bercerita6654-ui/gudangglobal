import React, { useState, useEffect, useMemo } from 'react';
import { User, Role, Order, OrderItem, SkuGroupData } from '../types';
import { isUserInGroup, getStandardArea, parseDateString, parseLaporanUrls, getDriveId, fetchWarehouseAccounts, WarehouseAccount } from '../services/api';
import { Search, RefreshCw, Edit3, Trash2, ArrowRight, Info } from 'lucide-react';

interface SkuHistorySectionProps {
  user: User;
  role: Role;
  orders: Order[];
  isLoadingOrders: boolean;
  onRefreshOrders: () => void;
  openEditOrderModal: (orderId: string) => void;
  onDeleteOrder: (orderId: string) => void;
  openDiscrepancyModal: (group: SkuGroupData) => void;
  openImageZoom: (src: string, driveId?: string) => void;
}

export const SkuHistorySection: React.FC<SkuHistorySectionProps> = ({
  user,
  role,
  orders,
  isLoadingOrders,
  onRefreshOrders,
  openEditOrderModal,
  onDeleteOrder,
  openDiscrepancyModal,
  openImageZoom
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState('bulan_ini');
  const [teamUserFilter, setTeamUserFilter] = useState('');
  const [sortFilter, setSortFilter] = useState('newest');
  const [warehouseAccounts, setWarehouseAccounts] = useState<WarehouseAccount[]>([]);

  useEffect(() => {
    fetchWarehouseAccounts()
      .then((accs) => setWarehouseAccounts(accs))
      .catch((e) => console.warn('Failed to load accounts for filter:', e));
  }, []);

  const isServer = role === 'server';
  const myArea = String(user.phone).toLowerCase();

  // Clean unique list of team usernames filtered by logged-in area if not server
  const teamUsernameList = useMemo(() => {
    const userArea = String(user.phone || user.name || '').toLowerCase();
    const set = new Set<string>();

    if (warehouseAccounts && warehouseAccounts.length > 0) {
      warehouseAccounts.forEach((a) => {
        if (a.username && a.username.trim()) {
          const accUsername = a.username.trim();
          const accArea = a.area || accUsername;
          if (isServer || isUserInGroup(userArea, accArea) || isUserInGroup(userArea, accUsername)) {
            set.add(accUsername);
          }
        }
      });
    }

    // Fallback if accounts not yet loaded or for default area users
    if (set.size === 0) {
      const defaultAreaMap: Record<string, string[]> = {
        area_barang_masuk: ['wildan', 'supar', 'udin', 'jefri', 'data'],
        area_floor_1: ['rahman'],
        area_lantai_2: ['andika', 'rusdi'],
        area_lantai_3: ['jun', 'wirna']
      };

      const stdArea = getStandardArea(userArea);
      if (isServer) {
        Object.values(defaultAreaMap).flat().forEach((u) => set.add(u));
      } else if (stdArea && defaultAreaMap[stdArea]) {
        defaultAreaMap[stdArea].forEach((u) => set.add(u));
      }
      if (user.name) set.add(user.name);
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [warehouseAccounts, isServer, user]);

  // Aggregate orders by SKU
  const skuGroupList = useMemo(() => {
    // 1. Filter internal transfers
    let myTransfers = orders.filter((o) => o?.customer?.name === 'INTERNAL_TRANSFER');

    if (!isServer) {
      myTransfers = myTransfers.filter((o) => {
        const target = String(o.customer.address).toLowerCase();
        const sender = String(o.customer.phone).toLowerCase();
        const note = String(o.note || '').toLowerCase();
        const userArea = String(user.phone || '').toLowerCase();
        const userName = String(user.name || '').toLowerCase();

        return (
          isUserInGroup(userArea, target) ||
          isUserInGroup(userArea, sender) ||
          isUserInGroup(userName, target) ||
          isUserInGroup(userName, sender) ||
          (userArea.length >= 3 && note.includes(userArea)) ||
          (userName.length >= 3 && note.includes(userName))
        );
      });
    }

    // 2. Time Filter (Hari ini, Kemarin, Mingguan, Bulan Ini, Spesifik Bulan)
    if (timeFilter && timeFilter !== 'semua') {
      myTransfers = myTransfers.filter((o) => {
        const orderTime = parseDateString(o.date);
        const now = new Date();

        if (orderTime > 0) {
          const orderDate = new Date(orderTime);
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const todayEnd = todayStart + 86400000 - 1;

          if (timeFilter === 'hari_ini') {
            return orderTime >= todayStart && orderTime <= todayEnd;
          } else if (timeFilter === 'kemarin') {
            const yesterdayStart = todayStart - 86400000;
            const yesterdayEnd = todayStart - 1;
            return orderTime >= yesterdayStart && orderTime <= yesterdayEnd;
          } else if (timeFilter === 'minggu_ini') {
            const sevenDaysAgo = todayStart - 6 * 86400000;
            return orderTime >= sevenDaysAgo && orderTime <= todayEnd;
          } else if (timeFilter === 'bulan_ini') {
            return orderDate.getFullYear() === now.getFullYear() && orderDate.getMonth() === now.getMonth();
          } else {
            const mNum = parseInt(timeFilter);
            if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
              return orderDate.getMonth() + 1 === mNum;
            }
          }
        } else {
          // Fallback string parser
          try {
            const datePart = o.date.split(',')[0].trim();
            const parts = datePart.split(/[\/\-]/);
            if (parts.length >= 3) {
              const orderDay = parseInt(parts[0]);
              const orderMonth = parseInt(parts[1]);
              const orderYear = parseInt(parts[2]);

              if (timeFilter === 'hari_ini') {
                return orderDay === now.getDate() && orderMonth === now.getMonth() + 1 && orderYear === now.getFullYear();
              } else if (timeFilter === 'kemarin') {
                const y = new Date(now.getTime() - 86400000);
                return orderDay === y.getDate() && orderMonth === y.getMonth() + 1 && orderYear === y.getFullYear();
              } else if (timeFilter === 'bulan_ini') {
                return orderMonth === now.getMonth() + 1 && orderYear === now.getFullYear();
              } else {
                const mNum = parseInt(timeFilter);
                if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
                  return orderMonth === mNum;
                }
              }
            }
          } catch (e) {}
        }
        return true;
      });
    }

    // 3. Team Username Filter
    if (teamUserFilter) {
      const uLower = teamUserFilter.toLowerCase().trim();
      myTransfers = myTransfers.filter((o) => {
        const noteStr = String(o.note || '').toLowerCase();
        const infoStr = String(o.gudangInfo || '').toLowerCase();
        const senderStr = String(o.customer.phone || '').toLowerCase();
        const targetStr = String(o.customer.address || '').toLowerCase();

        return (
          noteStr.includes(uLower) ||
          infoStr.includes(uLower) ||
          senderStr.includes(uLower) ||
          targetStr.includes(uLower)
        );
      });
    }

    const skuMap: Record<string, SkuGroupData> = {};
    const processedBatches: Record<string, boolean> = {};

    for (let i = 0; i < myTransfers.length; i++) {
      const o = myTransfers[i];
      let rName = '-';
      let rItems: any[] | null = null;

      if (o.gudangInfo && o.gudangInfo.indexOf('{') === 0) {
        try {
          const p = JSON.parse(o.gudangInfo);
          rName = p.name || '-';
          if (p.items) rItems = p.items;
          else if (p.qty !== undefined) {
            let firstSku = '-';
            let safeItems: OrderItem[] = [];
            if (Array.isArray(o.items)) safeItems = o.items;
            else if (typeof o.items === 'string') {
              try {
                safeItems = JSON.parse(o.items);
              } catch (e) {}
            }
            if (safeItems.length > 0 && safeItems[0].sku) firstSku = safeItems[0].sku;
            rItems = [{ sku: firstSku, qty: p.qty, totalQty: p.totalQty }];
          }
        } catch (e) {}
      } else if (o.gudangInfo) {
        rName = o.gudangInfo;
      }

      const senderPic = o.note ? o.note.split('-')[0].trim() : '-';

      let safeItems: OrderItem[] = [];
      if (Array.isArray(o.items)) safeItems = o.items;
      else if (typeof o.items === 'string') {
        try {
          safeItems = JSON.parse(o.items);
        } catch (e) {}
      }

      for (let k = 0; k < safeItems.length; k++) {
        const item = safeItems[k];
        if (!item.sku) continue;

        const skuKey = item.sku;
        if (!skuMap[skuKey]) {
          skuMap[skuKey] = {
            sku: item.sku,
            name: item.name || '-',
            unit: item.unit || 'pcs',
            supplierQty: 0,
            qtyTf: 0,
            qtyDiterima: 0,
            history: []
          };
        }

        const batchKey = `${o.date}-${skuKey}-${item.supplierQty}`;
        if (!processedBatches[batchKey]) {
          skuMap[skuKey].supplierQty += parseInt(item.supplierQty as any) || 0;
          processedBatches[batchKey] = true;
        }

        const qTf = parseInt(item.qty as any) || 0;
        skuMap[skuKey].qtyTf += qTf;

        let qTerima = 0;
        if (rItems && (o.status === 'Diterima' || o.status === 'Selesai')) {
          const rItem = rItems.find((r: any) => r.sku === skuKey);
          if (rItem) {
            qTerima = parseInt(rItem.qty) || 0;
            skuMap[skuKey].qtyDiterima += qTerima;
          }
        } else if (o.status === 'Disimpan') {
          qTerima = qTf;
          skuMap[skuKey].qtyDiterima += qTerima;
        }

        skuMap[skuKey].history.push({
          id: o.id,
          date: o.date,
          senderArea: o.customer.phone,
          senderPic,
          targetArea: o.customer.address,
          receiverPic: rName,
          qtyTf: qTf,
          qtyDiterima: qTerima,
          status: o.status,
          laporanUrl: o.laporanUrl,
          timestamp: parseDateString(o.date)
        });
      }
    }

    let results = Object.values(skuMap);

    // Filter Search
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      results = results.filter((item) => item.sku.toLowerCase().includes(q) || item.name.toLowerCase().includes(q));
    }

    // Sort
    results.forEach((item) => {
      let latest = 0;
      let oldest = Infinity;
      item.history.forEach((h) => {
        const t = h.timestamp || 0;
        if (t > latest) latest = t;
        if (t < oldest) oldest = t;
      });
      item.latestDate = latest;
      item.oldestDate = oldest === Infinity ? 0 : oldest;

      item.history.sort((a, b) => {
        if (sortFilter === 'oldest') return (a.timestamp || 0) - (b.timestamp || 0);
        return (b.timestamp || 0) - (a.timestamp || 0);
      });
    });

    results.sort((a, b) => {
      if (sortFilter === 'newest') return (b.latestDate || 0) - (a.latestDate || 0);
      if (sortFilter === 'oldest') return (a.oldestDate || 0) - (b.oldestDate || 0);
      return a.sku.localeCompare(b.sku);
    });

    return results;
  }, [orders, isServer, myArea, timeFilter, teamUserFilter, searchFilter, sortFilter]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 border-b border-slate-50 pb-4 gap-4">
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 whitespace-nowrap">
            <RefreshCw className="w-6 h-6 text-blue-500" />
            Riwayat Transfer by SKU
          </h2>

          <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-2 w-full lg:w-auto mt-4 lg:mt-0">
            {/* Search SKU */}
            <div className="relative col-span-2 md:col-span-1 w-full md:w-auto flex-1 md:flex-none">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Cari SKU / Produk..."
                className="pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-48 transition-all"
              />
            </div>

            {/* Time Filter */}
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer w-full md:w-auto"
            >
              <option value="bulan_ini">Bulan Ini (Berjalan)</option>
              <option value="hari_ini">Hari Ini</option>
              <option value="kemarin">Kemarin</option>
              <option value="minggu_ini">Mingguan (7 Hari Terakhir)</option>
              <option value="semua">Semua Waktu</option>
              <option value="1">Januari</option>
              <option value="2">Februari</option>
              <option value="3">Maret</option>
              <option value="4">April</option>
              <option value="5">Mei</option>
              <option value="6">Juni</option>
              <option value="7">Juli</option>
              <option value="8">Agustus</option>
              <option value="9">September</option>
              <option value="10">Oktober</option>
              <option value="11">November</option>
              <option value="12">Desember</option>
            </select>

            {/* Username Tim Filter */}
            <select
              value={teamUserFilter}
              onChange={(e) => setTeamUserFilter(e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer w-full md:w-auto"
            >
              <option value="">Semua Username Tim</option>
              {teamUsernameList.map((u) => (
                <option key={u} value={u}>
                  User: {u}
                </option>
              ))}
            </select>

            {/* Sort Filter */}
            <select
              value={sortFilter}
              onChange={(e) => setSortFilter(e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer w-full md:w-auto"
            >
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
              <option value="sku">SKU (A-Z)</option>
            </select>

            <button
              onClick={onRefreshOrders}
              className="col-span-2 md:col-span-1 text-xs bg-blue-50 text-blue-600 px-4 py-2.5 rounded-xl font-bold hover:bg-blue-100 transition-colors uppercase tracking-wider flex items-center justify-center gap-1 w-full md:w-auto cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {isLoadingOrders ? (
          <div className="py-16 text-center text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">
            Menarik data agregasi SKU...
          </div>
        ) : skuGroupList.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-medium bg-white rounded-xl border border-slate-100">
            Tidak ada data untuk filter yang dipilih.
          </div>
        ) : (
          <div className="w-full">
            <div className="hidden lg:grid grid-cols-12 gap-4 p-4 bg-slate-50 text-slate-500 uppercase text-xs tracking-wider font-black rounded-t-xl border-b border-slate-200">
              <div className="col-span-3">Info Produk</div>
              <div className="col-span-4 grid grid-cols-3 text-center">
                <span className="text-indigo-600 font-bold">Trima Splr</span>
                <span className="text-blue-600 font-bold">Qty TF</span>
                <span className="text-emerald-600 font-bold">Status Diterima</span>
              </div>
              <div className="col-span-5">Rincian Transaksi (Tgl, PIC, Bukti)</div>
            </div>

            <div className="flex flex-col lg:gap-0 divide-y-0 lg:divide-y divide-slate-100 text-slate-700">
              {skuGroupList.map((itemData) => {
                const diff = itemData.qtyTf - itemData.qtyDiterima;

                return (
                  <div
                    key={itemData.sku}
                    className="bg-white border lg:border-0 border-slate-200 rounded-2xl lg:rounded-none p-4 flex flex-col lg:grid lg:grid-cols-12 gap-4 hover:bg-slate-50/60 transition-colors shadow-sm lg:shadow-none mb-3 lg:mb-0 items-start"
                  >
                    {/* Info Produk */}
                    <div className="lg:col-span-3 flex flex-col gap-1 border-b border-slate-100 lg:border-0 pb-3 lg:pb-0 w-full">
                      <div className="font-black text-slate-900 text-base tracking-tight">{itemData.sku}</div>
                      <div className="font-bold text-slate-700 line-clamp-2 text-xs leading-snug">{itemData.name}</div>
                      <div className="text-xs text-slate-400 font-bold uppercase mt-0.5">Satuan: {itemData.unit}</div>
                    </div>

                    {/* Quantities & Balance */}
                    <div className="lg:col-span-4 grid grid-cols-3 gap-2 bg-slate-50 lg:bg-transparent p-3 lg:p-0 rounded-xl lg:rounded-none items-center w-full">
                      <div className="text-center border-r border-slate-200 lg:border-0">
                        <div className="text-[10px] font-black text-slate-400 uppercase lg:hidden mb-1">Trima Splr</div>
                        <div className="font-black text-indigo-600 text-base">{itemData.supplierQty}</div>
                      </div>
                      <div className="text-center border-r border-slate-200 lg:border-0">
                        <div className="text-[10px] font-black text-slate-400 uppercase lg:hidden mb-1">Qty TF</div>
                        <div className="font-black text-blue-600 text-base">{itemData.qtyTf}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] font-black text-slate-400 uppercase lg:hidden mb-1">Diterima</div>
                        <div className="font-black text-emerald-600 text-base">{itemData.qtyDiterima}</div>
                        <div>
                          {itemData.qtyTf === itemData.qtyDiterima ? (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-black uppercase inline-block mt-1">
                              Balance
                            </span>
                          ) : itemData.qtyDiterima > itemData.qtyTf ? (
                            <button
                              onClick={() => openDiscrepancyModal(itemData)}
                              className="px-2.5 py-1 bg-blue-100 text-blue-800 hover:bg-blue-200 rounded-lg text-xs font-black uppercase inline-flex items-center gap-1 mt-1 cursor-pointer transition-colors shadow-2xs"
                            >
                              Lebih {itemData.qtyDiterima - itemData.qtyTf} <Info className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => openDiscrepancyModal(itemData)}
                              className="px-2.5 py-1 bg-rose-100 text-rose-800 hover:bg-rose-200 rounded-lg text-xs font-black uppercase inline-flex items-center gap-1 mt-1 cursor-pointer transition-colors shadow-2xs"
                            >
                              Kurang {diff} <Info className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Transaction History Sublist */}
                    <div className="lg:col-span-5 bg-slate-50/80 rounded-2xl p-3 lg:p-3 border border-slate-100 w-full">
                      <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>Riwayat Transaksi ({itemData.history.length})</span>
                      </div>
                      <div className="max-h-56 overflow-y-auto custom-scrollbar pr-1 space-y-2.5">
                        {itemData.history.map((h) => {
                          const canManage = true;
                          const proofUrls = parseLaporanUrls(h.laporanUrl);

                          return (
                            <div key={h.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
                              <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-slate-100">
                                <div className="text-xs text-slate-500 font-bold flex items-center gap-1">
                                  <span>{h.date}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">({h.id})</span>
                                </div>
                                {canManage && (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => openEditOrderModal(h.id)}
                                      className="text-blue-600 hover:text-blue-800 p-1 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                                      title="Edit Transaksi"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => onDeleteOrder(h.id)}
                                      className="text-rose-600 hover:text-rose-800 p-1 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                                      title="Hapus Transaksi"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="text-xs font-semibold leading-relaxed text-slate-800 mb-2">
                                <span className="text-orange-600 font-black">{h.senderArea}</span>{' '}
                                <span className="text-slate-500 font-medium">({h.senderPic})</span>
                                <ArrowRight className="w-3.5 h-3.5 inline text-orange-500 mx-1.5" />
                                <span className="text-blue-600 font-black">{h.targetArea}</span>{' '}
                                <span className="text-slate-500 font-medium">({h.receiverPic})</span>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                                <div className="text-xs text-slate-700 font-bold flex items-center gap-1.5">
                                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                                    TF: <strong className="font-black">{h.qtyTf}</strong>
                                  </span>
                                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">
                                    Terima: <strong className="font-black">{h.qtyDiterima}</strong>
                                  </span>
                                </div>

                                <div className="flex gap-1.5">
                                  {proofUrls.map((u, pIdx) => {
                                    const driveId = getDriveId(u.url);
                                    const displayUrl = driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w200` : u.url;
                                    return (
                                      <img
                                        key={pIdx}
                                        src={displayUrl}
                                        alt="Bukti"
                                        referrerPolicy="no-referrer"
                                        onClick={() => openImageZoom(displayUrl, driveId || undefined)}
                                        className="w-9 h-9 rounded-lg border border-slate-200 object-cover cursor-zoom-in hover:scale-105 transition-transform shadow-2xs"
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
