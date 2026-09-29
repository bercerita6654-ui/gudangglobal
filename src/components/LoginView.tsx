import React, { useState, useEffect } from 'react';
import { User, Role } from '../types';
import { googleSignIn } from '../services/googleAuth';
import { fetchWarehouseAccounts, WarehouseAccount, getStandardArea } from '../services/api';
import { Box, Lock, ShieldCheck, Users } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (role: Role, user: User) => void;
  showAlert: (type: 'success' | 'warning', title: string, message: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, showAlert }) => {
  const [selectedArea, setSelectedArea] = useState('Barang Masuk');
  const [customArea, setCustomArea] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPinLogin, setShowPinLogin] = useState(true);
  
  // 2-Step Area & Sub Username Selection
  const [selectedLoginArea, setSelectedLoginArea] = useState<string>('Barang Masuk');
  const [pinIdentifier, setPinIdentifier] = useState('');
  const [pinPassword, setPinPassword] = useState('');

  // Loaded accounts from sheet "Gudang"
  const [warehouseAccounts, setWarehouseAccounts] = useState<WarehouseAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  useEffect(() => {
    setIsLoadingAccounts(true);
    fetchWarehouseAccounts()
      .then((accs) => {
        setWarehouseAccounts(accs);
      })
      .catch((e) => console.warn('Failed to load accounts from sheet Gudang:', e))
      .finally(() => setIsLoadingAccounts(false));
  }, []);

  // Clean unique list of Areas / Positions
  const uniqueAreas = React.useMemo(() => {
    const defaultAreas = [
      'Barang Masuk',
      'Lantai 2',
      'Lantai 3',
      'Toko'
    ];
    const set = new Set<string>();

    // First collect custom non-empty areas from accounts
    warehouseAccounts.forEach((acc) => {
      const a = (acc.area || '').trim();
      if (a && a.length >= 3) {
        // Exclude removed areas
        const aLower = a.toLowerCase();
        if (aLower.includes('floor 1') || aLower.includes('piranha') || aLower.includes('server pusat')) {
          return;
        }
        // Find if matches standard area
        const matched = defaultAreas.find((d) => d.toLowerCase() === aLower);
        if (matched) set.add(matched);
        else set.add(a);
      }
    });

    // Add default areas
    defaultAreas.forEach((d) => set.add(d));

    return Array.from(set);
  }, [warehouseAccounts]);

  // Filtered sub-usernames for selected Area / Position
  const filteredTeamUsernames = React.useMemo(() => {
    if (!selectedLoginArea) return [];
    const targetStd = getStandardArea(selectedLoginArea);
    const targetLower = selectedLoginArea.toLowerCase().trim();

    const matches = warehouseAccounts.filter((a) => {
      const aArea = (a.area || '').toLowerCase().trim();
      const aUser = (a.username || '').toLowerCase().trim();
      const aStd = getStandardArea(a.area || a.username);

      return (
        aStd === targetStd ||
        aArea === targetLower ||
        aArea.includes(targetLower) ||
        targetLower.includes(aArea)
      );
    });

    if (matches.length > 0) return matches;

    // Direct fallback for Barang Masuk as specified in prompt
    if (targetStd === 'area_barang_masuk' || targetLower.includes('masuk')) {
      return [
        { username: 'wildan', area: 'Barang Masuk', pin: '' },
        { username: 'supar', area: 'Barang Masuk', pin: '' },
        { username: 'udin', area: 'Barang Masuk', pin: '' },
        { username: 'jefri', area: 'Barang Masuk', pin: '' },
        { username: 'data', area: 'Barang Masuk', pin: '' }
      ];
    }

    return [{ username: selectedLoginArea, area: selectedLoginArea, pin: '' }];
  }, [warehouseAccounts, selectedLoginArea]);

  useEffect(() => {
    if (filteredTeamUsernames.length > 0) {
      setPinIdentifier(filteredTeamUsernames[0].username);
    } else if (selectedLoginArea) {
      setPinIdentifier(selectedLoginArea);
    } else {
      setPinIdentifier('');
    }
  }, [selectedLoginArea, filteredTeamUsernames]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await googleSignIn();
      if (!result) {
        setIsLoading(false);
        return;
      }

      const firebaseUser = result.user;
      const picName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'PIC Gudang';
      const userEmail = firebaseUser.email?.toLowerCase() || '';

      const effectiveArea = selectedArea === 'Lainnya' ? (customArea.trim() || 'Barang Masuk') : selectedArea;

      let assignedRole: Role = 'gudang';
      if (effectiveArea === 'Server Pusat' || userEmail.includes('server') || userEmail.includes('admin')) {
        assignedRole = 'server';
      }

      const userData: User = {
        name: picName,
        phone: effectiveArea
      };

      setIsLoading(false);
      showAlert('success', 'Login Berhasil', `Selamat datang, ${picName} (${effectiveArea})!`);
      onLoginSuccess(assignedRole, userData);
    } catch (err: any) {
      setIsLoading(false);
      console.error('Google Sign-in failed:', err);
      const effectiveArea = selectedArea === 'Lainnya' ? (customArea.trim() || 'Barang Masuk') : selectedArea;
      
      // Auto switch to manual PIN login view for convenience
      setShowPinLogin(true);
      setPinIdentifier(effectiveArea);
      
      showAlert('warning', 'Google Sign-in Terhalang', err.message || 'Koneksi Google Auth terhalang. Anda dialihkan ke Login Username & PIN Manual.');
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinIdentifier || !pinPassword) {
      showAlert('warning', 'Validasi', 'Mohon isi Username Area dan PIN Password.');
      return;
    }

    const cleanInputUser = pinIdentifier.trim().toLowerCase();
    const cleanInputPin = pinPassword.trim();

    // Check against accounts fetched from sheet Gudang
    const matched = warehouseAccounts.find(
      (a) =>
        a.username.toLowerCase() === cleanInputUser ||
        (a.area && a.area.toLowerCase() === cleanInputUser)
    );

    if (matched) {
      if (matched.pin && matched.pin !== cleanInputPin) {
        showAlert('warning', 'Login Gagal', 'PIN / Password tidak sesuai dengan akun Gudang.');
        return;
      }

      const assignedRole: Role =
        matched.role?.toLowerCase().includes('server') || matched.role?.toLowerCase().includes('admin') || cleanInputUser.includes('server')
          ? 'server'
          : 'gudang';

      onLoginSuccess(assignedRole, { name: matched.username, phone: matched.area || matched.username });
      showAlert('success', 'Login Berhasil', `Selamat datang, ${matched.username} (${matched.area || matched.username})`);
      return;
    }

    // Default fallback if sheet Gudang data not yet loaded or default accounts
    if (cleanInputUser === 'server' && cleanInputPin === '0000') {
      onLoginSuccess('server', { name: 'Server Pusat', phone: 'Server' });
      showAlert('success', 'Login Server', 'Masuk sebagai Super Admin Server Pusat.');
    } else {
      onLoginSuccess('gudang', { name: pinIdentifier, phone: pinIdentifier });
      showAlert('success', 'Login Area', `Masuk sebagai Area ${pinIdentifier}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 z-50 w-full relative bg-slate-50 font-['Inter',sans-serif]">
      <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 w-full max-w-md transition-all">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-200">
            <Box className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">SISTEM GUDANG</h2>
          <p className="text-sm text-slate-500 mt-2 font-medium">Global Mart Internal Portal</p>
        </div>

        {/* Info banner hidden per request */}

        {!showPinLogin ? (
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Pilih Area / Posisi Tugas Gudang
              </label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm bg-slate-50 focus:bg-white font-bold text-slate-700 cursor-pointer"
              >
                {warehouseAccounts.length > 0 ? (
                  warehouseAccounts.map((acc, idx) => (
                    <option key={idx} value={acc.username || acc.area}>
                      {acc.username} {acc.area && acc.area !== acc.username ? `(${acc.area})` : ''}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Barang Masuk">Barang Masuk (Pusat & Supplier)</option>
                    <option value="Toko">Toko Global Mart</option>
                    <option value="Lantai 2">Lantai 2</option>
                    <option value="Lantai 3">Lantai 3</option>
                  </>
                )}
                <option value="Lainnya">Area Lainnya / Manual</option>
              </select>
            </div>

            {selectedArea === 'Lainnya' && (
              <div>
                <input
                  type="text"
                  value={customArea}
                  onChange={(e) => setCustomArea(e.target.value)}
                  placeholder="Ketik Nama Area (e.g. Lt 4, Supar, Data)"
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm bg-slate-50 focus:bg-white font-medium"
                />
              </div>
            )}

            {/* Official Google Sign-In Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full gsi-material-button font-bold text-sm bg-white border border-slate-300 rounded-2xl px-4 py-3.5 flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-md cursor-pointer disabled:opacity-70 mt-4"
            >
              <div className="gsi-material-button-icon w-6 h-6 flex-shrink-0">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
              </div>
              <span className="gsi-material-button-contents font-black text-slate-800 tracking-wide text-sm">
                {isLoading ? 'Menghubungkan Google...' : 'Sign in with Google'}
              </span>
            </button>

            <div className="pt-4 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => setShowPinLogin(true)}
                className="text-xs text-slate-400 hover:text-orange-600 font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 mx-auto"
              >
                <Lock className="w-3.5 h-3.5" /> Masuk dengan Username & PIN Manual
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            {/* Step 1: Pilih Nama Area / Posisi */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                1. Pilih Nama Area / Posisi
              </label>
              <select
                value={selectedLoginArea}
                onChange={(e) => setSelectedLoginArea(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-bold text-slate-800 bg-slate-50 focus:bg-white cursor-pointer"
              >
                <option value="">-- Pilih Nama Area / Posisi --</option>
                {uniqueAreas.map((areaName, idx) => (
                  <option key={idx} value={areaName}>
                    {areaName}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Pilih Sub Nama / Username Tim (HANYA MUNCUL SETELAH AREA DIPILIH) */}
            {selectedLoginArea ? (
              <div className="transition-all duration-300">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  2. Pilih Username Tim ({selectedLoginArea})
                </label>
                <select
                  value={pinIdentifier}
                  onChange={(e) => setPinIdentifier(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-bold text-orange-600 bg-orange-50/50 focus:bg-white cursor-pointer"
                >
                  {filteredTeamUsernames.map((acc, idx) => (
                    <option key={idx} value={acc.username}>
                      {acc.username}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Step 3: Password / PIN (HANYA MUNCUL SETELAH USERNAME TERSEDIA) */}
            {selectedLoginArea && pinIdentifier ? (
              <div className="transition-all duration-300">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  3. Password / PIN Akses ({pinIdentifier})
                </label>
                <input
                  type="password"
                  value={pinPassword}
                  onChange={(e) => setPinPassword(e.target.value)}
                  placeholder="Masukkan PIN Akses"
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-medium bg-slate-50 focus:bg-white"
                  required
                />
              </div>
            ) : null}

            {selectedLoginArea ? (
              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-orange-500 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md text-sm mt-2 cursor-pointer"
              >
                Masuk Manual
              </button>
            ) : null}

            {/* Bottom link hidden per request */}
          </form>
        )}
      </div>
    </div>
  );
};
