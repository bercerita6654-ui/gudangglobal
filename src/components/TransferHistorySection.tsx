import React, { useState, useEffect, useMemo } from 'react';
import { User, Role, Order, OrderItem } from '../types';
import { isUserInGroup, getStandardArea, getDriveId, parseLaporanUrls, fetchWarehouseAccounts, WarehouseAccount, parseDateString } from '../services/api';
import { RefreshCw, Search, ArrowRight, CheckCircle2, Clock, Box, Eye, ImageIcon, Layers, Filter } from 'lucide-react';

interface TransferHistorySectionProps {
  user: User;
  role: Role;
  orders: Order[];
  isLoadingOrders: boolean;
  onRefreshOrders: () => void;
  openReceiveModal: (orderIds: string[]) => void;
  openOrderDetail: (order: Order) => void;
  openImageZoom: (src: string, driveId?: string) => void;
  initialSearch?: string;
}

export const TransferHistorySection: React.FC<TransferHistorySectionProps> = ({
  user,
  role,
  orders,
  isLoadingOrders,
  onRefreshOrders,
  openReceiveModal,
  openOrderDetail,
  openImageZoom,
  initialSearch = ''
}) => {
  const [selectedReceiveIds, setSelectedReceiveIds] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState(initialSearch);
  const [timeFilter, setTimeFilter] = useState('bulan_ini');
  const [locFilter, setLocFilter] = useState('');
  const [teamUserFilter, setTeamUserFilter] = useState('');
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

  // Filter transfers
  const filteredTransfers = useMemo(() => {
    // 1. Only INTERNAL_TRANSFER
    let myTransfers = orders.filter((o) => o?.customer?.name === 'INTERNAL_TRANSFER');

    // 2. Filter by User Area if not server
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

    // 3. Time, Loc, Team User, and Search Filter
    return myTransfers.filter((o) => {
      // Time Filter (Hari ini, Kemarin, Mingguan, Bulan Ini, Spesifik Bulan)
      if (timeFilter && timeFilter !== 'semua') {
        const orderTime = parseDateString(o.date);
        const now = new Date();

        if (orderTime > 0) {
          const orderDate = new Date(orderTime);
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const todayEnd = todayStart + 86400000 - 1;

          if (timeFilter === 'hari_ini') {
            if (orderTime < todayStart || orderTime > todayEnd) return false;
          } else if (timeFilter === 'kemarin') {
            const yesterdayStart = todayStart - 86400000;
            const yesterdayEnd = todayStart - 1;
            if (orderTime < yesterdayStart || orderTime > yesterdayEnd) return false;
          } else if (timeFilter === 'minggu_ini') {
            const sevenDaysAgo = todayStart - 6 * 86400000;
            if (orderTime < sevenDaysAgo || orderTime > todayEnd) return false;
          } else if (timeFilter === 'bulan_ini') {
            if (orderDate.getFullYear() !== now.getFullYear() || orderDate.getMonth() !== now.getMonth()) return false;
          } else {
            const mNum = parseInt(timeFilter);
            if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
              if (orderDate.getMonth() + 1 !== mNum) return false;
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
                if (orderDay !== now.getDate() || orderMonth !== now.getMonth() + 1 || orderYear !== now.getFullYear()) return false;
              } else if (timeFilter === 'kemarin') {
                const y = new Date(now.getTime() - 86400000);
                if (orderDay !== y.getDate() || orderMonth !== y.getMonth() + 1 || orderYear !== y.getFullYear()) return false;
              } else if (timeFilter === 'bulan_ini') {
                if (orderMonth !== now.getMonth() + 1 || orderYear !== now.getFullYear()) return false;
              } else {
                const mNum = parseInt(timeFilter);
                if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
                  if (orderMonth !== mNum) return false;
                }
              }
            }
          } catch (e) {}
        }
      }

      // Loc Filter
      if (locFilter) {
        const targetStd = getStandardArea(o.customer.address);
        const senderStd = getStandardArea(o.customer.phone);
        const filterStd = getStandardArea(locFilter);
        if (targetStd !== filterStd && senderStd !== filterStd) return false;
      }

      // Team Username Filter
      if (teamUserFilter) {
        const uLower = teamUserFilter.toLowerCase().trim();
        const noteStr = String(o.note || '').toLowerCase();
        let infoStr = String(o.gudangInfo || '').toLowerCase();

        if (o.gudangInfo && o.gudangInfo.startsWith('{')) {
          try {
            const p = JSON.parse(o.gudangInfo);
            if (p.name) infoStr += ' ' + String(p.name).toLowerCase();
          } catch (e) {}
        }

        const senderStr = String(o.customer?.phone || '').toLowerCase();
        const targetStr = String(o.customer?.address || '').toLowerCase();

        const isMatch =
          noteStr.includes(uLower) ||
          infoStr.includes(uLower) ||
          senderStr.includes(uLower) ||
          targetStr.includes(uLower);

        if (!isMatch) return false;
      }

      // Search Filter
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase().trim();
        let safeItems: OrderItem[] = [];
        if (Array.isArray(o.items)) safeItems = o.items;
        else if (typeof o.items === 'string') {
          try {
            safeItems = JSON.parse(o.items);
          } catch (e) {}
        }
        const itemsStr = safeItems.map((it) => `${it.sku || ''} ${it.name || ''}`).join(' ');
        const searchStr = `${o.id} ${o.note || ''} ${itemsStr}`.toLowerCase();
        if (!searchStr.includes(q)) return false;
      }

      return true;
    });
  }, [orders, isServer, myArea, timeFilter, locFilter, teamUserFilter, searchFilter]);

  // Reversed for latest first
  const reversedTransfers = useMemo(() => {
    return [...filteredTransfers].reverse();
  }, [filteredTransfers]);

  // Stats summary
  const stats = useMemo(() => {
    let pending = 0;
    let completed = 0;
    reversedTransfers.forEach((o) => {
      if (o.status === 'Diterima' || o.status === 'Disimpan' || o.status === 'Selesai') {
        completed++;
      } else {
        pending++;
      }
    });
    return { total: reversedTransfers.length, pending, completed };
  }, [reversedTransfers]);

  const toggleSelectReceive = (id: string) => {
    setSelectedReceiveIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const pendingTransfers = useMemo(() => {
    return reversedTransfers.filter(
      (o) => o.status !== 'Diterima' && o.status !== 'Disimpan' && o.status !== 'Selesai'
    );
  }, [reversedTransfers]);

  const isAllPendingSelected =
    pendingTransfers.length > 0 &&
    pendingTransfers.every((o) => selectedReceiveIds.includes(o.id));

  const toggleSelectAllPending = () => {
    if (isAllPendingSelected) {
      setSelectedReceiveIds([]);
    } else {
      setSelectedReceiveIds(pendingTransfers.map((o) => o.id));
    }
  };

  const handleProcessSelectedReceive = () => {
    if (selectedReceiveIds.length > 0) {
      openReceiveModal(selectedReceiveIds);
      setSelectedReceiveIds([]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Visual Stat Cards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Transfer</p>
            <p className="text-2xl font-black text-slate-800 mt-0.5">{stats.total} <span className="text-xs font-semibold text-slate-400">Transaksi</span></p>
          </div>
          <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Sedang Dikirim / Menunggu</p>
            <p className="text-2xl font-black text-amber-600 mt-0.5">{stats.pending} <span className="text-xs font-semibold text-amber-400">Pengiriman</span></p>
          </div>
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Selesai Diterima</p>
            <p className="text-2xl font-black text-emerald-600 mt-0.5">{stats.completed} <span className="text-xs font-semibold text-emerald-400">Diterima</span></p>
          </div>
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Mass Acceptance Banner */}
      {selectedReceiveIds.length > 0 && (
        <div className="p-4 md:p-5 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg">
          <div className="flex items-center gap-4 w-full md:w-auto justify-center md:justify-start">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center font-black text-lg">
              {selectedReceiveIds.length}
            </div>
            <div>
              <h4 className="text-sm font-black leading-tight">Kiriman Terpilih</h4>
              <p className="text-[11px] text-orange-100 mt-0.5">Siap untuk dikonfirmasi penerimaan secara bersamaan</p>
            </div>
          </div>
          <button
            onClick={handleProcessSelectedReceive}
            className="w-full md:w-auto bg-white text-orange-600 px-6 py-3 rounded-xl text-xs font-black shadow-md hover:bg-orange-50 transition-colors uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            KONFIRMASI TERIMA SEKALIGUS
          </button>
        </div>
      )}

      {/* Control Toolbar */}
      <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 pb-4 border-b border-slate-100 gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-orange-500" />
              Riwayat Transfer Barang
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Pantau dan kelola pengiriman serta penerimaan barang antar lokasi</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Search Box */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Cari ID, SKU, atau Produk..."
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              />
            </div>

            {/* Time Filter */}
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer"
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

            {/* Location Filter */}
            <select
              value={locFilter}
              onChange={(e) => setLocFilter(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer"
            >
              <option value="">Semua Lokasi</option>
              <option value="barang masuk">Barang Masuk</option>
              <option value="toko">Toko</option>
              <option value="piranha">Gudang Piranha</option>
              <option value="floor 1">Floor 1</option>
              <option value="lantai 2">Lantai 2</option>
              <option value="lantai 3">Lantai 3</option>
            </select>

            {/* Username Tim Filter */}
            <select
              value={teamUserFilter}
              onChange={(e) => setTeamUserFilter(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer"
            >
              <option value="">Semua Username Tim</option>
              {teamUsernameList.map((u) => (
                <option key={u} value={u}>
                  User: {u}
                </option>
              ))}
            </select>

            {/* Select All / Multi Select Button */}
            {pendingTransfers.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAllPending}
                className={`text-xs px-3.5 py-2.5 rounded-xl font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isAllPendingSelected
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isAllPendingSelected}
                  onChange={() => {}}
                  className="w-4 h-4 cursor-pointer accent-orange-500 rounded"
                />
                <span>Pilih Semua ({pendingTransfers.length})</span>
              </button>
            )}

            <button
              onClick={onRefreshOrders}
              className="text-xs bg-orange-50 text-orange-600 px-4 py-2.5 rounded-xl font-bold hover:bg-orange-100 transition-colors uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Transfer Cards List */}
        {isLoadingOrders ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Menarik data riwayat transfer...</span>
          </div>
        ) : reversedTransfers.length === 0 ? (
          <div className="py-16 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400 font-medium">
            <Filter className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-bold text-slate-600">Tidak ada data transfer ditemukan</p>
            <p className="text-[11px] text-slate-400 mt-1">Coba ubah kata kunci pencarian atau filter lokasi/bulan.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reversedTransfers.map((o) => {
              let safeItems: OrderItem[] = [];
              if (Array.isArray(o.items)) safeItems = o.items;
              else if (typeof o.items === 'string') {
                try {
                  safeItems = JSON.parse(o.items);
                } catch (e) {}
              }

              const isCompleted = o.status === 'Diterima' || o.status === 'Disimpan' || o.status === 'Selesai';

              let isReceiver = false;
              if (!isServer && user) {
                const target = String(o.customer.address).toLowerCase();
                isReceiver = isUserInGroup(myArea, target);
              }

              const proofUrls = parseLaporanUrls(o.laporanUrl);

              let receiverInfoName = '';
              let receiverItems: any[] | null = null;

              if (o.gudangInfo) {
                if (o.gudangInfo.indexOf('{') === 0) {
                  try {
                    const p = JSON.parse(o.gudangInfo);
                    receiverInfoName = p.name || '';
                    if (p.items) {
                      receiverItems = p.items;
                    } else if (p.qty !== undefined) {
                      const firstSku = safeItems.length > 0 ? safeItems[0].sku : '-';
                      receiverItems = [{ sku: firstSku, qty: p.qty, totalQty: p.totalQty }];
                    }
                  } catch (e) {}
                } else {
                  receiverInfoName = o.gudangInfo;
                }
              }

              const isChecked = selectedReceiveIds.includes(o.id);

              return (
                <div
                  key={o.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden relative"
                >
                  {/* Card Header: ID, Date, Route & Status */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
                    <div className="flex items-center gap-3">
                      {!isCompleted && (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectReceive(o.id)}
                          className="w-5 h-5 cursor-pointer accent-orange-500 rounded border-slate-300 shrink-0"
                          title="Pilih untuk konfirmasi terima sekaligus"
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            onClick={() => openOrderDetail(o)}
                            className="font-black text-blue-600 hover:text-blue-800 text-sm cursor-pointer underline decoration-blue-200 underline-offset-2"
                          >
                            {o.id}
                          </span>
                          <span className="text-sm font-bold text-[#272f3b]" style={{ fontSize: '14px', color: '#272f3b' }}>
                            &bull; {o.date}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Pengirim: <span className="font-semibold text-slate-700">{o.note || '-'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Route Visual Badge */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-semibold mr-1.5 uppercase">Dari:</span>
                        {o.customer.phone}
                      </div>

                      <ArrowRight className="w-4 h-4 text-orange-500 shrink-0" />

                      <div className="flex items-center bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-bold border border-blue-200">
                        <span className="text-[10px] text-blue-400 font-semibold mr-1.5 uppercase">Ke:</span>
                        {o.customer.address}
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase ml-auto md:ml-2 ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {o.status}
                      </span>
                    </div>
                  </div>

                  {/* Card Content: Items Table & Proof / Actions */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* Item List Sub-table (Col 8) */}
                    <div className="lg:col-span-8 bg-slate-50/80 rounded-xl p-3 border border-slate-100">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                        <span>Daftar Barang Transfer ({safeItems.length} SKU)</span>
                        {receiverInfoName && (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            Penerima: {receiverInfoName}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {safeItems.map((it, idx) => {
                          let rItem = { qty: 0, totalQty: 0 };
                          if (receiverItems) {
                            const matched = receiverItems.find((r) => r.sku === it.sku);
                            if (matched) rItem = matched;
                          }
                          const sQty = it.qty || 0;
                          const sTotal = it.totalQty || sQty;
                          const isBalance = Number(rItem.qty) === Number(sQty) && Number(rItem.totalQty) === Number(sTotal);

                          return (
                            <div
                              key={idx}
                              className="bg-white p-2.5 rounded-lg border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-orange-600 text-xs">{it.sku || '-'}</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">{it.unit || 'Pcs'}</span>
                                </div>
                                <div className="font-bold text-slate-800 text-xs mt-0.5 line-clamp-1">{it.name}</div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-black text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                  TF: {it.qty} {it.unit || 'pcs'}
                                </span>

                                {it.supplierQty ? (
                                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                                    Splr: {it.supplierQty}
                                  </span>
                                ) : null}

                                {receiverItems && isCompleted && (
                                  <span
                                    className={`text-[9px] font-black px-2 py-1 rounded text-white ${
                                      isBalance ? 'bg-emerald-600' : 'bg-rose-600'
                                    }`}
                                  >
                                    Terima: {rItem.qty} ({isBalance ? 'Sesuai' : 'Selisih'})
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions & Proof Cards (Col 4) */}
                    <div className="lg:col-span-4 flex flex-col gap-3 justify-between h-full">
                      {/* Action Buttons */}
                      <div>
                        {isCompleted ? (
                          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                            <span className="text-emerald-700 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" /> DITERIMA & SELESAI
                            </span>
                          </div>
                        ) : isReceiver ? (
                          <button
                            onClick={() => openReceiveModal([o.id])}
                            className="w-full bg-orange-500 text-white py-3 px-4 rounded-xl font-black text-xs shadow-md hover:bg-orange-600 transition-colors uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" /> KONFIRMASI TERIMA BARANG
                          </button>
                        ) : (
                          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-center">
                            <span className="text-amber-700 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5">
                              <Clock className="w-4 h-4" /> MENUNGGU DITERIMA OLEH {o.customer.address}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Proof Images Gallery */}
                      {proofUrls.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5 text-blue-500" /> Foto Bukti Pengiriman ({proofUrls.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {proofUrls.map((u, idx) => {
                              const driveId = getDriveId(u.url);
                              const displayUrl = driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w500` : u.url;

                              return (
                                <div
                                  key={idx}
                                  onClick={() => openImageZoom(displayUrl, driveId || undefined)}
                                  className="group relative w-16 h-16 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 cursor-pointer shadow-2xs hover:shadow-md transition-all"
                                >
                                  <img
                                    src={displayUrl}
                                    alt="Bukti"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      if (driveId && !target.dataset.retry) {
                                        target.dataset.retry = '1';
                                        target.src = `https://drive.google.com/uc?export=view&id=${driveId}`;
                                      } else {
                                        target.src = 'https://placehold.co/100x100/f8fafc/ef4444?text=Foto';
                                      }
                                    }}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                  />
                                  <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Eye className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
