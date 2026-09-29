import React, { useState, useMemo, useRef } from 'react';
import { Product, TransferCartItem, User } from '../types';
import { formatRupiah, resizeImageFile, fetchGAS } from '../services/api';
import { appendSpreadsheetValues } from '../services/googleWorkspace';
import { Box, Search, Plus, Trash2, RefreshCw, CheckCircle2, ZoomIn } from 'lucide-react';

interface CatalogSectionProps {
  user: User;
  allProducts: Product[];
  isLoadingCatalog: boolean;
  onRefreshCatalog: () => void;
  onRefreshOrders: () => void;
  openImageZoom: (src: string, driveId?: string) => void;
  showAlert: (type: 'success' | 'warning', title: string, message: string) => void;
}

export const CatalogSection: React.FC<CatalogSectionProps> = ({
  user,
  allProducts,
  isLoadingCatalog,
  onRefreshCatalog,
  onRefreshOrders,
  openImageZoom,
  showAlert
}) => {
  // Transfer Cart State
  const [transferCart, setTransferCart] = useState<TransferCartItem[]>([]);
  const [skuSearchQuery, setSkuSearchQuery] = useState('');
  const [selectedBulkBrand, setSelectedBulkBrand] = useState('');
  const [selectedProofFiles, setSelectedProofFiles] = useState<File[]>([]);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [submitProgressText, setSubmitProgressText] = useState('KIRIM SEMUA BARANG SEKARANG');

  // Catalog Grid State
  const [catalogSearch, setCatalogSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [merkFilter, setMerkFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const formRef = useRef<HTMLDivElement>(null);

  // Derived Categories & Brands
  const categories = useMemo(() => {
    const set = new Set<string>();
    allProducts.forEach((p) => set.add(p.category));
    return Array.from(set).sort();
  }, [allProducts]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    allProducts.forEach((p) => set.add(p.merk));
    return Array.from(set).sort();
  }, [allProducts]);

  // SKU Search Results for Transfer Search Input
  const skuSearchResults = useMemo(() => {
    if (skuSearchQuery.trim().length < 2) return [];
    const q = skuSearchQuery.toLowerCase().trim();
    return allProducts
      .filter((p) => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .slice(0, 15);
  }, [allProducts, skuSearchQuery]);

  // Catalog Filtered Products
  const filteredProducts = useMemo(() => {
    const q = catalogSearch.toLowerCase().trim();
    return allProducts.filter((p) => {
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchCategory = !categoryFilter || p.category === categoryFilter;
      const matchMerk = !merkFilter || p.merk === merkFilter;
      return matchSearch && matchCategory && matchMerk;
    });
  }, [allProducts, catalogSearch, categoryFilter, merkFilter]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  // Add Product to Cart
  const addProductToCart = (product: Product) => {
    setTransferCart((prev) => {
      const exists = prev.some((item) => item.sku === product.sku);
      if (exists) {
        showAlert('warning', 'Sudah Ada', `Produk SKU ${product.sku} sudah ada di daftar transfer.`);
        return prev;
      }
      return [
        ...prev,
        {
          sku: product.sku,
          name: product.name,
          unit: product.unit || 'Pcs',
          supplierQty: 0,
          dest: {
            'Barang Masuk': 0,
            'Toko': 0,
            'Gudang Piranha': 0,
            'Floor 1': 0,
            'Lantai 2': 0,
            'Lantai 3': 0
          },
          note: ''
        }
      ];
    });
  };

  const handleSelectForTransfer = (product: Product) => {
    addProductToCart(product);
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleBulkAddBrand = () => {
    if (!selectedBulkBrand) {
      showAlert('warning', 'Validasi', 'Silakan pilih Merek terlebih dahulu dari dropdown.');
      return;
    }

    const matches = allProducts.filter((p) => p.merk === selectedBulkBrand);
    if (matches.length === 0) {
      showAlert('warning', 'Kosong', `Tidak ada produk yang ditemukan dengan merek ${selectedBulkBrand}`);
      return;
    }

    let addedCount = 0;
    let skipCount = 0;

    setTransferCart((prev) => {
      const newItems = [...prev];
      matches.forEach((p) => {
        if (!newItems.some((it) => it.sku === p.sku)) {
          newItems.push({
            sku: p.sku,
            name: p.name,
            unit: p.unit || 'Pcs',
            supplierQty: 0,
            dest: {
              'Barang Masuk': 0,
              'Toko': 0,
              'Gudang Piranha': 0,
              'Floor 1': 0,
              'Lantai 2': 0,
              'Lantai 3': 0
            },
            note: ''
          });
          addedCount++;
        } else {
          skipCount++;
        }
      });
      return newItems;
    });

    if (addedCount > 0) {
      let msg = `Berhasil menambahkan ${addedCount} produk dengan merek ${selectedBulkBrand} ke daftar.`;
      if (skipCount > 0) msg += `\n(${skipCount} produk sudah ada di daftar dan dilewati).`;
      showAlert('success', 'Berhasil', msg);
      setSelectedBulkBrand('');
    } else {
      showAlert('warning', 'Info', `Semua produk dengan merek ${selectedBulkBrand} sudah ada di dalam daftar.`);
    }
  };

  const updateDestQty = (index: number, destName: keyof TransferCartItem['dest'], value: number) => {
    setTransferCart((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], dest: { ...updated[index].dest } };
      item.dest[destName] = isNaN(value) ? 0 : value;

      if (destName === 'Barang Masuk') {
        const sum =
          (item.dest['Barang Masuk'] || 0) +
          (item.dest['Toko'] || 0) +
          (item.dest['Gudang Piranha'] || 0) +
          (item.dest['Floor 1'] || 0) +
          (item.dest['Lantai 2'] || 0) +
          (item.dest['Lantai 3'] || 0);
        item.supplierQty = sum;
      } else {
        const sq = item.supplierQty || 0;
        const otherSum =
          (item.dest['Toko'] || 0) +
          (item.dest['Gudang Piranha'] || 0) +
          (item.dest['Floor 1'] || 0) +
          (item.dest['Lantai 2'] || 0) +
          (item.dest['Lantai 3'] || 0);
        item.dest['Barang Masuk'] = sq - otherSum;
      }

      updated[index] = item;
      return updated;
    });
  };

  const removeCartItem = (index: number) => {
    setTransferCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setTransferCart([]);
    setSelectedProofFiles([]);
    showAlert('success', 'Daftar Dikosongkan', 'Seluruh isi daftar keranjang transfer telah dikosongkan.');
  };

  // Submit Mass Transfer
  const handleSubmitTransfer = async () => {
    if (transferCart.length === 0) return;

    for (let i = 0; i < transferCart.length; i++) {
      const item = transferCart[i];
      const sq = item.supplierQty || 0;
      let sumTf = 0;
      for (const d in item.dest) {
        const destVal = item.dest[d as keyof TransferCartItem['dest']] || 0;
        if (destVal < 0) {
          showAlert('warning', 'Validasi Gagal', `Qty untuk SKU ${item.sku} tidak boleh minus.`);
          return;
        }
        sumTf += destVal;
      }

      if (sq <= 0) {
        showAlert('warning', 'Validasi Gagal', `Total Qty (Terima Supplier) untuk SKU ${item.sku} harus lebih dari 0.`);
        return;
      }
      if (sumTf !== sq) {
        showAlert('warning', 'Validasi Gagal', `Sistem mendeteksi ketidaksesuaian jumlah pada SKU ${item.sku}. Pastikan Total = Jumlah Distribusi.`);
        return;
      }
      if (sumTf === 0) {
        showAlert('warning', 'Validasi Gagal', `Harap isi minimal 1 tujuan/lokasi distribusi untuk SKU ${item.sku}.`);
        return;
      }
    }

    for (let f = 0; f < selectedProofFiles.length; f++) {
      if (selectedProofFiles[f].size > 2 * 1024 * 1024) {
        showAlert('warning', 'File Terlalu Besar', 'Maksimal ukuran tiap foto bukti adalah 2MB.');
        return;
      }
    }

    setIsSubmittingTransfer(true);
    setSubmitProgressText('MEMPROSES...');

    try {
      // 1. Upload proof files sequentially
      const validUrls: string[] = [];
      for (let i = 0; i < selectedProofFiles.length; i++) {
        setSubmitProgressText(`MENGUNGGAH BUKTI (${i + 1}/${selectedProofFiles.length})...`);
        const file = selectedProofFiles[i];
        try {
          const { mimeType, base64 } = await resizeImageFile(file, 600);
          const upRes = await fetchGAS({
            action: 'upload_image',
            filename: `Kirim_Gudang_${Date.now()}_${i}.png`,
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
          console.error('Error uploading proof image:', e);
        }
      }

      setSubmitProgressText('MENGIRIM DATA...');

      // 2. Automatically append rows to Spreadsheet 1gPxfWt_DDK_5qxutQgZ85ZjwDyVSJrj9f-bHPG0vOZM sheet "BARANG MASUK"
      const rowsToAppend = transferCart.map((item) => [
        new Date().toLocaleString('id-ID'),
        item.sku,
        item.name,
        item.unit || 'Pcs',
        item.supplierQty || 0,
        item.dest['Barang Masuk'] || 0,
        item.dest['Toko'] || 0,
        item.dest['Gudang Piranha'] || 0,
        item.dest['Floor 1'] || 0,
        item.dest['Lantai 2'] || 0,
        item.dest['Lantai 3'] || 0,
        item.note || '',
        `${user.name} (${user.phone})`
      ]);

      const targetSpreadsheetId = '1gPxfWt_DDK_5qxutQgZ85ZjwDyVSJrj9f-bHPG0vOZM';
      
      // Try direct Google Sheets API append if logged in with Google
      appendSpreadsheetValues(targetSpreadsheetId, "'BARANG MASUK'!A:M", rowsToAppend)
        .catch((e) => console.warn('Direct Google Sheets API append warning:', e));

      // Also send to GAS backend for automatic recording
      fetchGAS({
        action: 'append_barang_masuk',
        spreadsheetId: targetSpreadsheetId,
        sheetName: 'BARANG MASUK',
        rows: rowsToAppend
      }).catch((e) => console.warn('GAS append_barang_masuk warning:', e));

      // 3. Group items by destination
      const groupedOrders: Record<string, { items: any[]; notes: string[] }> = {};
      for (let i = 0; i < transferCart.length; i++) {
        const item = transferCart[i];
        for (const dest in item.dest) {
          const destQty = item.dest[dest as keyof TransferCartItem['dest']] || 0;
          if (destQty > 0) {
            if (!groupedOrders[dest]) groupedOrders[dest] = { items: [], notes: [] };
            groupedOrders[dest].items.push({
              sku: item.sku,
              name: item.name,
              supplierQty: item.supplierQty,
              qty: destQty,
              unit: item.unit,
              totalQty: destQty,
              price: 0
            });
            if (item.note) groupedOrders[dest].notes.push(item.note);
          }
        }
      }

      // 3. Create order per destination
      const promises: Promise<any>[] = [];
      for (const destName in groupedOrders) {
        const group = groupedOrders[destName];
        const uniqueNotes = Array.from(new Set(group.notes));
        const allNotes = uniqueNotes.join(', ');
        const finalNote = user.name + (allNotes ? ' - Catatan: ' + allNotes : '');
        const initialStatus =
          destName === 'Barang Masuk' || destName === 'Gudang Piranha' || destName === 'Toko' ? 'Disimpan' : 'Sedang Dikirim';

        const transferOrderId = `TF-${destName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}-${Date.now()}${Math.floor(Math.random() * 1000)}`;

        const orderData = {
          action: 'create_order',
          id: transferOrderId,
          date: new Date().toLocaleString('id-ID'),
          customer: JSON.stringify({ name: 'INTERNAL_TRANSFER', phone: user.phone, address: destName }),
          items: JSON.stringify(group.items),
          totalAmount: 0,
          status: initialStatus,
          note: finalNote,
          gudangInfo: destName === 'Barang Masuk' || destName === 'Gudang Piranha' || destName === 'Toko' ? `${user.name} (Disimpan)` : ''
        };

        let req = fetchGAS(orderData);

        if (validUrls.length > 0) {
          req = req.then(() => {
            const laporanData = validUrls.map((url) => ({ area: user.phone, url }));
            return fetchGAS({
              action: 'update_order',
              id: transferOrderId,
              status: initialStatus,
              laporanUrl: JSON.stringify(laporanData)
            });
          });
        }
        promises.push(req);
      }

      await Promise.all(promises);

      setTransferCart([]);
      setSelectedProofFiles([]);
      showAlert('success', 'Berhasil Terkirim', 'Semua barang dalam daftar telah didistribusikan ke lokasi masing-masing.');
      onRefreshOrders();
    } catch (err: any) {
      showAlert('warning', 'Error', 'Gagal mengirim data. Silakan coba lagi. ' + (err.message || ''));
    } finally {
      setIsSubmittingTransfer(false);
      setSubmitProgressText('KIRIM SEMUA BARANG SEKARANG');
    }
  };

  return (
    <div className="space-y-6">
      {/* Sender Form Container */}
      <div
        ref={formRef}
        className="mb-2 p-5 sm:p-6 bg-slate-50 border border-slate-200 shadow-sm rounded-3xl relative overflow-visible"
      >
        <div className="absolute top-0 left-0 w-2 h-full bg-orange-500 rounded-l-3xl"></div>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <Box className="w-5 h-5 text-orange-500" />
            Keranjang Transfer Massal (Pecah Qty)
          </h3>
        </div>

        <div className="space-y-4">
          {/* Pencarian & Bulk Add */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Tambahkan Produk ke Daftar (Ketik SKU / Nama Produk)
              </label>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-4" />
                <input
                  type="text"
                  value={skuSearchQuery}
                  onChange={(e) => setSkuSearchQuery(e.target.value)}
                  placeholder="Ketik minimal 2 huruf/angka, lalu klik produk yang muncul..."
                  className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-sm"
                />
              </div>

              {/* SKU Search Result Dropdown */}
              {skuSearchResults.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-2 z-50 overflow-hidden text-sm divide-y divide-slate-50 max-h-60 overflow-y-auto">
                  {skuSearchResults.map((p) => {
                    const inCart = transferCart.some((it) => it.sku === p.sku);
                    return (
                      <div
                        key={p.sku}
                        onClick={() => {
                          addProductToCart(p);
                          setSkuSearchQuery('');
                        }}
                        className="px-4 py-3 hover:bg-orange-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors flex justify-between items-center"
                      >
                        <div>
                          <div className="font-black text-orange-600 text-[10px] uppercase tracking-widest">{p.sku}</div>
                          <div className="font-bold text-slate-700 text-sm mt-0.5 truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                            Kat: {p.category} &bull; Merk: {p.merk} &bull; Unit: {p.unit}
                            {p.stockQty !== undefined ? ` \u2022 Stok: ${p.stockQty}` : ''}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-black px-2 py-1 rounded transition-colors shrink-0 ml-2 ${
                            inCart ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {inCart ? '✓ Masuk' : '+ Tambah'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="sm:w-64">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Bulk Add per Merek
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedBulkBrand}
                  onChange={(e) => {
                    const brand = e.target.value;
                    setSelectedBulkBrand(brand);
                    if (brand) {
                      const brandProducts = allProducts.filter(
                        (p) => String(p.merk).toLowerCase().trim() === String(brand).toLowerCase().trim()
                      );
                      if (brandProducts.length === 0) {
                        showAlert('warning', 'Tidak Ada Produk', `Tidak ada produk dengan merek "${brand}".`);
                        return;
                      }

                      setTransferCart((prev) => {
                        const existingSkus = new Set(prev.map((i) => i.sku));
                        const newItems: TransferCartItem[] = [];

                        brandProducts.forEach((p) => {
                          if (!existingSkus.has(p.sku)) {
                            newItems.push({
                              sku: p.sku,
                              name: p.name,
                              unit: p.unit || 'Pcs',
                              supplierQty: p.stockQty || 0,
                              dest: {
                                'Barang Masuk': p.stockQty || 0,
                                'Toko': 0,
                                'Gudang Piranha': 0,
                                'Floor 1': 0,
                                'Lantai 2': 0,
                                'Lantai 3': 0
                              },
                              note: ''
                            });
                          }
                        });

                        if (newItems.length === 0) {
                          showAlert('warning', 'Sudah Ada', `Semua produk merek "${brand}" sudah ada di keranjang.`);
                          return prev;
                        }

                        showAlert('success', 'Berhasil Ditambahkan', `Menambahkan ${newItems.length} produk merek "${brand}".`);
                        return [...prev, ...newItems];
                      });
                    }
                  }}
                  className="w-full px-3 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer shadow-sm"
                >
                  <option value="">Pilih Merek...</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  style={{ display: 'none' }}
                  onClick={handleBulkAddBrand}
                  className="hidden bg-orange-500 text-white p-3.5 rounded-xl hover:bg-orange-600 transition-colors shadow-sm cursor-pointer"
                  title="Tambahkan semua produk dengan merek ini"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* LIST KERANJANG TRANSFER */}
          {transferCart.length > 0 ? (
            <div className="mt-6 border border-orange-100 bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Edit Langsung Qty & Tujuan
                </h4>
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-[9px] text-rose-500 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                >
                  Kosongkan Daftar
                </button>
              </div>

              <div className="overflow-x-auto custom-scrollbar pb-2 max-h-[50vh]">
                <table className="w-full text-left text-xs border-collapse min-w-[1150px]">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[8px] font-black tracking-widest sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-2 border-b border-slate-200 rounded-tl-lg min-w-[150px] bg-slate-50">SKU & Produk</th>
                      <th className="p-2 border-b border-slate-200 w-24 text-center text-indigo-600 bg-slate-50 text-[14px]" style={{ fontSize: '14px' }} title="Qty yang diterima dari supplier">
                        Trima Splr
                      </th>
                      <th className="p-2 border-b border-slate-200 w-24 text-center bg-slate-50 text-blue-600 text-[14px]" style={{ fontSize: '14px' }} title="Sisa barang akan otomatis masuk ke sini">
                        B. Masuk (Sisa)
                      </th>
                      <th className="p-2 border-b border-slate-200 w-24 text-center bg-slate-50 text-blue-600 text-[14px]" style={{ fontSize: '14px' }}>Toko</th>
                      <th className="p-2 border-b border-slate-200 w-24 text-center bg-slate-50 text-blue-600 text-[14px]" style={{ fontSize: '14px' }}>Piranha</th>
                      <th className="p-2 border-b border-slate-200 w-24 text-center bg-slate-50 text-blue-600 text-[14px]" style={{ fontSize: '14px' }}>Floor 1</th>
                      <th className="p-2 border-b border-slate-200 w-24 text-center bg-slate-50 text-blue-600 text-[14px]" style={{ fontSize: '14px' }}>Lt 2</th>
                      <th className="p-2 border-b border-slate-200 text-center bg-slate-50 text-blue-600 text-[14px]" style={{ fontSize: '14px', width: '102.9961px' }}>Lt 3</th>
                      <th className="p-2 border-b border-slate-200 min-w-[100px] bg-slate-50 text-center text-[12px]" style={{ fontSize: '12px', textAlign: 'center' }}>Catatan</th>
                      <th className="p-2 border-b border-slate-200 w-12 text-center rounded-tr-lg bg-slate-50">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {transferCart.map((item, index) => (
                      <tr key={item.sku} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2 border-b border-slate-100 align-top">
                          <div className="font-black text-orange-600 text-[10px] uppercase">{item.sku}</div>
                          <div className="font-bold text-slate-800 line-clamp-2 leading-snug mt-0.5">{item.name}</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">Unit: {item.unit}</div>
                        </td>
                        <td className="p-2 border-b border-slate-100 align-top">
                          <input
                            type="number"
                            value={item.supplierQty || ''}
                            readOnly
                            placeholder="0"
                            className="inline-input bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed shadow-none"
                            title="Terkunci (Hanya View)"
                          />
                        </td>
                        <td className="p-2 border-b border-slate-100 align-top">
                          <input
                            type="number"
                            value={item.dest['Barang Masuk'] || ''}
                            onChange={(e) => updateDestQty(index, 'Barang Masuk', parseInt(e.target.value))}
                            placeholder="0"
                            className="inline-input bg-blue-50 border-blue-200 text-blue-700 font-black shadow-inner"
                          />
                        </td>
                        <td className="p-2 border-b border-slate-100 align-top">
                          <input
                            type="number"
                            value={item.dest['Toko'] || ''}
                            onChange={(e) => updateDestQty(index, 'Toko', parseInt(e.target.value))}
                            placeholder="0"
                            className="inline-input"
                          />
                        </td>
                        <td className="p-2 border-b border-slate-100 align-top">
                          <input
                            type="number"
                            value={item.dest['Gudang Piranha'] || ''}
                            onChange={(e) => updateDestQty(index, 'Gudang Piranha', parseInt(e.target.value))}
                            placeholder="0"
                            className="inline-input"
                          />
                        </td>
                        <td className="p-2 border-b border-slate-100 align-top">
                          <input
                            type="number"
                            value={item.dest['Floor 1'] || ''}
                            onChange={(e) => updateDestQty(index, 'Floor 1', parseInt(e.target.value))}
                            placeholder="0"
                            className="inline-input"
                          />
                        </td>
                        <td className="p-2 border-b border-slate-100 align-top">
                          <input
                            type="number"
                            value={item.dest['Lantai 2'] || ''}
                            onChange={(e) => updateDestQty(index, 'Lantai 2', parseInt(e.target.value))}
                            placeholder="0"
                            className="inline-input"
                          />
                        </td>
                        <td className="p-2 border-b border-slate-100 align-top">
                          <input
                            type="number"
                            value={item.dest['Lantai 3'] || ''}
                            onChange={(e) => updateDestQty(index, 'Lantai 3', parseInt(e.target.value))}
                            placeholder="0"
                            className="inline-input"
                          />
                        </td>
                        <td className="p-2 border-b border-slate-100 align-top">
                          <input
                            type="text"
                            value={item.note}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTransferCart((prev) => {
                                const up = [...prev];
                                up[index] = { ...up[index], note: val };
                                return up;
                              });
                            }}
                            placeholder="Catatan..."
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </td>
                        <td className="p-2 border-b border-slate-100 text-center align-top">
                          <button
                            type="button"
                            onClick={() => removeCartItem(index)}
                            className="text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 p-1.5 rounded-md transition-colors w-full flex justify-center items-center h-[30px] cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* BUKTI FOTO PENGIRIMAN hidden per user request */}

              <button
                type="button"
                disabled={isSubmittingTransfer}
                onClick={handleSubmitTransfer}
                className="mt-4 w-full bg-slate-900 text-white py-4 rounded-xl font-black text-[12px] tracking-widest hover:bg-orange-500 transition-colors shadow-lg flex justify-center items-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span>{submitProgressText}</span>
                {isSubmittingTransfer && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
              </button>
            </div>
          ) : (
            <div className="mt-2 border border-slate-200 bg-white rounded-2xl p-8 text-center text-slate-400">
              <Box className="w-12 h-12 mx-auto mb-3 text-slate-200" />
              <p className="text-xs font-medium">
                Ketik SKU di atas atau pilih Merek untuk menambahkan barang ke daftar pengiriman secara massal.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Product Catalog Grid Controls */}
      <div className="flex flex-col lg:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mt-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={catalogSearch}
            onChange={(e) => {
              setCatalogSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari nama produk atau SKU..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm font-medium bg-slate-50"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 transform -translate-y-1/2" />
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full lg:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none text-sm font-bold text-slate-700 cursor-pointer min-w-[120px]"
          >
            <option value="">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={merkFilter}
            onChange={(e) => {
              setMerkFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none text-sm font-bold text-slate-700 cursor-pointer min-w-[120px]"
          >
            <option value="">Semua Merk</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <button
            onClick={onRefreshCatalog}
            className="text-xs bg-blue-50 text-blue-600 px-5 py-3 rounded-xl font-bold hover:bg-blue-100 transition-colors uppercase tracking-wider flex items-center justify-center gap-1 sm:w-auto w-full shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {isLoadingCatalog ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <span className="text-slate-500 font-bold text-sm tracking-wider uppercase">Mengunduh Katalog...</span>
        </div>
      ) : paginatedProducts.length === 0 ? (
        <div className="py-16 bg-white rounded-2xl border border-slate-100 text-center text-slate-400 font-medium">
          Katalog kosong atau produk tidak ditemukan.
        </div>
      ) : (
        <>
          {/* Grid Products */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {paginatedProducts.map((p) => {
              const primarySrc = p.driveId ? `https://lh3.googleusercontent.com/d/${p.driveId}` : p.img;
              return (
                <div
                  key={p.id}
                  className="bg-white rounded-xl border border-slate-100 p-2 shadow-sm flex flex-col group hover:shadow-xl transition-all duration-300 relative overflow-hidden"
                >
                  <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md text-white text-[8px] font-black tracking-widest px-1.5 py-1 rounded z-10 shadow-sm border border-slate-700/50">
                    {p.sku}
                  </div>
                  <div
                    className="aspect-square w-full overflow-hidden rounded-lg bg-slate-50 mb-2 relative flex items-center justify-center cursor-zoom-in p-1 group/img"
                    onClick={() => openImageZoom(primarySrc, p.driveId)}
                  >
                    <img
                      src={primarySrc}
                      alt={p.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (p.driveId && !target.dataset.retry) {
                          target.dataset.retry = '1';
                          target.src = `https://drive.google.com/thumbnail?id=${p.driveId}&sz=w500`;
                        } else {
                          target.src = 'https://placehold.co/300x300/f8fafc/64748b?text=Gambar+Kosong';
                        }
                      }}
                      className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                      <ZoomIn className="w-5 h-5 text-white" />
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col px-0.5">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate">
                      {p.merk}
                    </span>
                    <h3 className="text-[10px] font-bold text-slate-800 line-clamp-2 leading-tight mb-1">{p.name}</h3>
                    <div className="mt-auto pt-1 border-t border-slate-50 flex items-end justify-between">
                      <div>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">{p.unit}</p>
                        {p.stockQty !== undefined && (
                          <p
                            className={`font-black text-[10px] leading-none ${
                              Number(p.stockQty) > 0 ? 'text-emerald-600' : 'text-rose-600 font-bold'
                            }`}
                          >
                            Stok: {p.stockQty || 0}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectForTransfer(p)}
                    className="mt-2 w-full bg-slate-900 text-white text-[9px] py-1.5 rounded-lg font-black tracking-widest hover:bg-orange-500 transition-colors flex justify-center items-center gap-1 cursor-pointer"
                  >
                    <Box className="w-3 h-3" /> TF
                  </button>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center mt-10 gap-3">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="px-4 py-2 bg-white shadow-sm border border-slate-100 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Prev
              </button>
              <span className="text-[10px] font-black text-slate-400 px-3">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="px-4 py-2 bg-white shadow-sm border border-slate-100 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
