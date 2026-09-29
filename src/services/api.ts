import Papa from 'papaparse';
import { Product, Order, LaporanUrlItem } from '../types';

export const API_URL = "https://script.google.com/macros/s/AKfycbw7r1WzZPKwddIfM88iLEEGnFVYBJD2u4f3NpO33xhS74duAXyuILExIkEiamTNjff-/exec";

export const STOCK_LIST_SPREADSHEET_ID = "1mrD9sQK_Sffa1X1fzlCDmaJXs1Yj2q-XTNdi2sRGPos";
export const MAIN_CSV_URL = `https://docs.google.com/spreadsheets/d/${STOCK_LIST_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=STOCK%20LIST`;
export const MAIN_CSV_URL_ALT = `https://docs.google.com/spreadsheets/d/${STOCK_LIST_SPREADSHEET_ID}/export?format=csv&sheet=STOCK%20LIST`;
export const MAIN_CSV_URL_PUB = `https://docs.google.com/spreadsheets/d/${STOCK_LIST_SPREADSHEET_ID}/export?format=csv&gid=0`;

export const FILTERS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRrRDnJctzeF3FC_-81KzNHZIX3epxC6WwdmIbhXBGl1rlRKvSUfsvsZCZtuiPyULe5b2wJXOIYK8hs/pub?gid=481142784&single=true&output=csv";
export const IMAGES_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQCHIxS7HnRy1yBymwbV0Cdulgoww5XprrhwwDSVlOsnzAMmyQ209HYCpGvgOscdeCUYLVEpUAtxMRI/pub?output=csv";

export const GUDANG_SPREADSHEET_ID = "1gPxfWt_DDK_5qxutQgZ85ZjwDyVSJrj9f-bHPG0vOZM";
export const ACCOUNTS_CSV_URL = `https://docs.google.com/spreadsheets/d/${GUDANG_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Gudang`;
export const ACCOUNTS_CSV_URL_ALT = `https://docs.google.com/spreadsheets/d/${GUDANG_SPREADSHEET_ID}/export?format=csv&sheet=Gudang`;

export interface WarehouseAccount {
  username: string;
  pin: string;
  role?: string;
  area?: string;
}

export let warehouseAccountMap: Record<string, string> = {};

export async function fetchWarehouseAccounts(): Promise<WarehouseAccount[]> {
  let rows: any[][] = [];
  try {
    rows = await fetchCSVRaw(ACCOUNTS_CSV_URL);
  } catch (e1) {
    try {
      rows = await fetchCSVRaw(ACCOUNTS_CSV_URL_ALT);
    } catch (e2) {
      console.warn("Fetch warehouse accounts CSV failed:", e2);
      return [];
    }
  }

  if (!rows || rows.length === 0) return [];

  // Determine starting row (skip header row)
  let startIdx = 0;
  if (rows.length > 0) {
    const firstRowStr = String(rows[0]).toLowerCase();
    if (
      firstRowStr.includes('username') ||
      firstRowStr.includes('user') ||
      firstRowStr.includes('nama') ||
      firstRowStr.includes('area') ||
      firstRowStr.includes('pin') ||
      firstRowStr.includes('password')
    ) {
      startIdx = 1;
    }
  }

  const accounts: WarehouseAccount[] = [];
  warehouseAccountMap = {};

  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !Array.isArray(r) || r.length === 0) continue;

    // Column mapping for Sheet Gudang:
    // Kolom 1 (index 0): Username Tim (e.g. wildan, supar, udin, jefri)
    // Kolom 2 (index 1): PIN / Password
    // Kolom 3 (index 2): Nama Area / Posisi (e.g. Barang Masuk, Floor 1, Lantai 2, Lantai 3, Toko, Gudang Piranha)
    // Kolom 4 (index 3): Role / Info
    const username = String(r[0] || '').trim();
    const pin = String(r[1] || '').trim();
    
    // Column 3 is strictly Nama Area / Posisi
    let area = String(r[2] || '').trim();
    if (!area && r[3] && !r[3].match(/^\d+$/)) {
      area = String(r[3]).trim();
    }

    const role = String(r[3] || '').trim();

    if (username) {
      accounts.push({ username, pin, role, area });
      if (area) {
        warehouseAccountMap[username.toLowerCase()] = area.toLowerCase();
      }
    }
  }

  return accounts;
}

export async function fetchGAS(payload: any): Promise<any> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("GAS Error Response:", text);
    if (text.toLowerCase().includes("html")) {
      throw new Error("Respon server berupa HTML. Pastikan hak akses deployment adalah 'Anyone'.");
    }
    throw new Error("Respon server Google tidak valid (" + text.substring(0, 30) + "...). Periksa Code.gs Anda.");
  }
}

export function getStandardArea(name: string | undefined | null): string {
  if (!name) return '';
  const n = String(name).toLowerCase().trim();
  const mapped = (warehouseAccountMap[n] || n).toLowerCase().trim();

  if (mapped.indexOf('masuk') > -1 || mapped === 'data' || mapped === 'jefri' || mapped === 'supar' || mapped === 'udin' || mapped === 'wildan') return 'area_barang_masuk';
  if (mapped.indexOf('floor') > -1 || mapped === 'f1' || mapped === 'rahman') return 'area_floor_1';
  if (mapped.indexOf('2') > -1 || mapped.indexOf('dua') > -1 || mapped === 'andika' || mapped === 'rusdi') return 'area_lantai_2';
  if (mapped.indexOf('3') > -1 || mapped.indexOf('tiga') > -1 || mapped === 'jun' || mapped === 'wirna') return 'area_lantai_3';
  if (mapped.indexOf('toko') > -1) return 'area_toko';
  if (mapped.indexOf('piranha') > -1) return 'area_piranha';
  return mapped;
}

export function isUserInGroup(username: string | undefined | null, checkArea: string | undefined | null): boolean {
  if (!username || !checkArea) return false;
  const uClean = String(username).toLowerCase().trim();
  const cClean = String(checkArea).toLowerCase().trim();

  if (uClean === cClean) return true;

  const areaA = (warehouseAccountMap[uClean] || uClean).toLowerCase().trim();
  const areaB = (warehouseAccountMap[cClean] || cClean).toLowerCase().trim();

  if (areaA === areaB) return true;

  const userStd = getStandardArea(areaA);
  const areaStd = getStandardArea(areaB);

  if (userStd && areaStd && userStd === areaStd) return true;

  if (
    (userStd === 'area_barang_masuk' || areaA.includes('masuk')) &&
    (areaStd === 'area_toko' || areaStd === 'area_piranha' || areaB.includes('toko') || areaB.includes('piranha'))
  ) {
    return true;
  }

  if (uClean.length >= 3 && cClean.length >= 3) {
    if (uClean.includes(cClean) || cClean.includes(uClean)) return true;
  }

  return false;
}

export function extractSKU(str: any): string | null {
  if (!str) return null;
  const s = String(str).trim();
  const match = s.match(/\d{1,5}/);
  if (match) {
    return match[0].padStart(5, '0');
  }
  return null;
}

export function getDriveId(url: string | undefined | null): string | null {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export function parseLaporanUrls(urlStr: string | undefined | null): LaporanUrlItem[] {
  if (!urlStr) return [];
  try {
    const parsed = JSON.parse(urlStr);
    if (Array.isArray(parsed)) return parsed;
    return [{ area: 'Gudang', url: urlStr }];
  } catch (e) {
    return [{ area: 'Gudang', url: urlStr }];
  }
}

export function parseDateString(dateStr: string | undefined | null): number {
  if (!dateStr) return 0;
  try {
    const cleanStr = dateStr.replace(/\./g, ':').replace(/,/g, '');
    const p = cleanStr.split(/\s+/);
    const dParts = p[0].split(/[\/\-]/);
    if (dParts.length < 3) return 0;
    const tParts = p[1] ? p[1].split(':') : [0, 0, 0];
    
    let year = parseInt(dParts[2]);
    let month = parseInt(dParts[1]) - 1;
    let day = parseInt(dParts[0]);

    if (dParts[0].length === 4) {
      year = parseInt(dParts[0]);
      month = parseInt(dParts[1]) - 1;
      day = parseInt(dParts[2]);
    }

    const d = new Date(
      year,
      month,
      day,
      parseInt(tParts[0] as any) || 0,
      parseInt(tParts[1] as any) || 0,
      parseInt(tParts[2] as any) || 0
    );

    return isNaN(d.getTime()) ? 0 : d.getTime();
  } catch (e) {
    return 0;
  }
}

export function formatRupiah(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

export function getValFromRow(row: Record<string, any>, keyStr: string): any {
  if (!row) return null;
  const keys = Object.keys(row);
  let found: string | null = null;

  // Exact or case-insensitive key search
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase().trim() === keyStr.toLowerCase().trim()) {
      found = keys[i];
      break;
    }
  }

  // Alias checks if not found directly
  if (!found) {
    const kStr = keyStr.toLowerCase().trim();
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i].toLowerCase().trim();
      if (kStr === 'sku' && (k.includes('sku') || k.includes('kode') || k === 'id')) {
        found = keys[i];
        break;
      }
      if (kStr === 'nama produk' && (k.includes('nama') || k.includes('deskripsi') || k.includes('product') || k.includes('item'))) {
        found = keys[i];
        break;
      }
      if (kStr === 'eceran' && (k.includes('eceran') || k.includes('harga') || k.includes('price'))) {
        found = keys[i];
        break;
      }
      if (kStr === 'unit' && (k.includes('unit') || k.includes('satuan') || k.includes('uom'))) {
        found = keys[i];
        break;
      }
      if (kStr === 'gambar' && (k.includes('gambar') || k.includes('link') || k.includes('photo') || k.includes('foto') || k.includes('image') || k.includes('url'))) {
        found = keys[i];
        break;
      }
    }
  }

  return found ? row[found] : null;
}

function fetchCSVRaw(url: string): Promise<any[][]> {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          resolve(results.data as any[][]);
        } else {
          reject(new Error('CSV Data Empty'));
        }
      },
      error: (error) => reject(error)
    });
  });
}

function fetchCSV(url: string): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          resolve(results.data as Record<string, any>[]);
        } else {
          reject(new Error('CSV Data Empty'));
        }
      },
      error: (error) => reject(error)
    });
  });
}

export async function loadCatalogData(): Promise<Product[]> {
  let mainRows: any[][] = [];
  let imagesCsv: Record<string, any>[] = [];

  // Fetch MAIN_CSV_URL and IMAGES_CSV_URL in parallel for maximum speed
  try {
    const [mRows, imgCsv] = await Promise.all([
      fetchCSVRaw(MAIN_CSV_URL).catch(async () => {
        try {
          return await fetchCSVRaw(MAIN_CSV_URL_ALT);
        } catch {
          return await fetchCSVRaw(MAIN_CSV_URL_PUB);
        }
      }),
      fetchCSV(IMAGES_CSV_URL).catch(() => [])
    ]);

    mainRows = mRows || [];
    imagesCsv = imgCsv || [];
  } catch (e) {
    console.warn("Catalog fetch warning:", e);
  }

  // Build image map from IMAGES_CSV_URL
  const imageMap: Record<string, string> = {};
  if (imagesCsv && imagesCsv.length > 0) {
    for (let i = 0; i < imagesCsv.length; i++) {
      const r = imagesCsv[i];
      const vals: any[] = [];
      for (const k in r) vals.push(r[k]);
      const rawName = r['Name'] || r['File'] || r['SKU'] || r['ID'] || r['Nama File'] || vals[0];
      const rawUrl = r['URL'] || r['Link'] || r['Gambar'] || r['Photo'] || vals[1];

      if (rawUrl) {
        let cleanKey = extractSKU(rawName);
        if (!cleanKey) {
          const parts = String(rawUrl).split('/');
          cleanKey = extractSKU(parts[parts.length - 1]);
        }
        if (cleanKey) {
          imageMap[cleanKey] = rawUrl;
        }
      }
    }
  }

  // Product data starts from row 2 (index 1 of mainRows array)
  const startIdx = 1;

  const mappedProducts: Product[] = [];
  for (let i = startIdx; i < mainRows.length; i++) {
    const row = mainRows[i];
    if (!row || !Array.isArray(row) || row.length === 0) continue;

    // Column mapping:
    // SKU: Kolom 1 (index 0)
    // Nama Produk: Kolom 3 (index 2)
    // Unit: Kolom 4 (index 3)
    // Kategori: Kolom 5 (index 4)
    // Merk: Kolom 7 (index 6)
    // Qty: Kolom 15 (index 14)
    // Gambar/Foto: Kolom 24 (index 23)
    const skuRaw = row[0];
    const namaRaw = row[2];
    const unitRaw = row[3];
    const kategoriRaw = row[4];
    const merkRaw = row[6];
    const qtyRaw = row[14];
    
    // Column 24 is index 23
    let gambarRaw = row[23] || row[24] || row[22];

    // If column 24 is empty, search row for any IMAGE formula or Drive link
    if (!gambarRaw || !String(gambarRaw).trim()) {
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim();
        if (
          val.toUpperCase().includes('IMAGE(') ||
          val.includes('drive.google.com') ||
          val.includes('lh3.googleusercontent.com')
        ) {
          gambarRaw = val;
          break;
        }
      }
    }

    if (!skuRaw && !namaRaw) continue;

    const safeSku = String(skuRaw || '-').trim();
    const safeName = String(namaRaw || 'Produk').trim();
    const safeUnit = String(unitRaw || 'Pcs').trim();
    const finalCategory = String(kategoriRaw || 'Katalog Global').trim() || 'Katalog Global';
    const finalMerk = String(merkRaw || 'Global Mart').trim() || 'Global Mart';
    const stockQty = parseFloat(String(qtyRaw || '0').replace(/[^\d.-]/g, '')) || 0;

    const skuKey = extractSKU(safeSku);

    let imgUrl = '';
    let driveId = '';

    // 1. Check gambar column (col 24) first with full formula, ID & URL support
    if (gambarRaw && String(gambarRaw).trim()) {
      const gStr = String(gambarRaw).trim();
      const formulaMatch = gStr.match(/IMAGE\s*\(\s*["']?([^"'()]+)["']?\s*\)/i) || gStr.match(/IMAGE\("([^"]+)"\)/i);
      const cleanStr = formulaMatch ? formulaMatch[1] : gStr;

      const match = cleanStr.match(/\/d\/([a-zA-Z0-9_-]+)/) || cleanStr.match(/[?&]id=([a-zA-Z0-9_-]+)/) || cleanStr.match(/id=([a-zA-Z0-9_-]+)/);
      if (match) {
        driveId = match[1];
        imgUrl = `https://lh3.googleusercontent.com/d/${driveId}`;
      } else if (cleanStr.startsWith('http://') || cleanStr.startsWith('https://')) {
        imgUrl = cleanStr;
      } else if (cleanStr.length >= 20 && !cleanStr.includes(' ') && !cleanStr.includes('/')) {
        driveId = cleanStr;
        imgUrl = `https://lh3.googleusercontent.com/d/${driveId}`;
      }
    }

    // 2. Fallback to imageMap from IMAGES_CSV_URL using SKU key
    if (!driveId && !imgUrl && skuKey && imageMap[skuKey]) {
      imgUrl = imageMap[skuKey];
      const match = imgUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || imgUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/) || imgUrl.match(/id=([a-zA-Z0-9_-]+)/);
      if (match) driveId = match[1];
    }

    if (driveId && imgUrl.indexOf('googleusercontent') === -1) {
      imgUrl = 'https://drive.google.com/thumbnail?id=' + driveId + '&sz=w250';
    } else if (!imgUrl || imgUrl.trim() === '') {
      imgUrl = 'https://placehold.co/300x300/f8fafc/64748b?text=Gambar+Kosong';
    }

    mappedProducts.push({
      id: 'prod_' + i,
      sku: safeSku,
      name: safeName,
      price: 0,
      unit: safeUnit,
      img: imgUrl,
      driveId: driveId || '',
      category: finalCategory,
      merk: finalMerk,
      stockQty
    });
  }

  return mappedProducts;
}

export function resizeImageFile(file: File, maxDimension = 600): Promise<{ mimeType: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height *= maxDimension / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width *= maxDimension / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas context error'));
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        let base64Data = canvas.toDataURL(mimeType, 0.6);
        if (base64Data.indexOf(',') > -1) {
          base64Data = base64Data.split(',')[1];
        }

        resolve({ mimeType, base64: base64Data });
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsDataURL(file);
  });
}
