import { useState, useEffect, useCallback } from 'react';
import { User, Role, Product, Order, SkuGroupData, AlertModalState } from './types';
import { loadCatalogData, fetchGAS } from './services/api';
import { LoginView } from './components/LoginView';
import { Header } from './components/Header';
import { CatalogSection } from './components/CatalogSection';
import { TransferHistorySection } from './components/TransferHistorySection';
import { SkuHistorySection } from './components/SkuHistorySection';
import { UploadImageSection } from './components/UploadImageSection';
import { GoogleWorkspacePanel } from './components/GoogleWorkspacePanel';

import { ReceiveConfirmModal } from './components/modals/ReceiveConfirmModal';
import { OrderDetailModal } from './components/modals/OrderDetailModal';
import { EditOrderModal } from './components/modals/EditOrderModal';
import { DiscrepancyModal } from './components/modals/DiscrepancyModal';
import { ImageZoomModal } from './components/modals/ImageZoomModal';
import { AlertModal } from './components/modals/AlertModal';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>('gudang');
  const [activeView, setActiveView] = useState<string>('gudang');

  // Data
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // Modals & Search Filters
  const [alertState, setAlertState] = useState<AlertModalState>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });

  const [receiveModalIds, setReceiveModalIds] = useState<string[]>([]);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);

  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [discrepancySkuGroup, setDiscrepancySkuGroup] = useState<SkuGroupData | null>(null);
  const [imageZoom, setImageZoom] = useState<{ src: string | null; driveId?: string }>({ src: null });
  const [transferHistoryInitialSearch, setTransferHistoryInitialSearch] = useState('');

  const showAlert = useCallback((type: 'success' | 'warning', title: string, message: string) => {
    setAlertState({
      isOpen: true,
      type,
      title,
      message
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Fetch Catalog
  const handleFetchCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    try {
      const data = await loadCatalogData();
      setAllProducts(data);
    } catch (e: any) {
      console.error('Error loading catalog:', e);
      showAlert('warning', 'Gagal Memuat Katalog', 'Mohon periksa koneksi internet Anda atau coba muat ulang.');
    } finally {
      setIsLoadingCatalog(false);
    }
  }, [showAlert]);

  // Fetch Orders
  const handleFetchOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      const res = await fetch(
        'https://script.google.com/macros/s/AKfycbw7r1WzZPKwddIfM88iLEEGnFVYBJD2u4f3NpO33xhS74duAXyuILExIkEiamTNjff-/exec'
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setOrders(data);
      }
    } catch (e) {
      console.error('Error fetching orders:', e);
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  const handleLoginSuccess = (userRole: Role, userData: User) => {
    setUser(userData);
    setRole(userRole);

    const areaStr = String(userData.phone).toLowerCase();
    const isBarangMasuk = areaStr.includes('masuk') || areaStr.includes('data');

    if (userRole === 'gudang' && isBarangMasuk) {
      setActiveView('katalog');
    } else {
      setActiveView('gudang');
    }

    handleFetchCatalog();
    handleFetchOrders();
  };

  const handleLogout = () => {
    setUser(null);
    setActiveView('gudang');
    showAlert('success', 'Logged Out', 'Sesi Anda telah diakhiri dengan aman.');
  };

  const handleOpenEditOrderModal = (orderId: string) => {
    const targetOrder = orders.find((o) => String(o.id) === String(orderId));

    if (targetOrder && user) {
      const currentUserName = (user.name || '').toLowerCase().trim();
      const currentUserPhone = (user.phone || '').toLowerCase().trim();

      const orderNote = (targetOrder.note || '').toLowerCase().trim();
      const orderSenderPhone = (targetOrder.customer?.phone || '').toLowerCase().trim();
      const orderGudangInfo = (targetOrder.gudangInfo || '').toLowerCase().trim();

      const isServer = role === 'server';
      let isOwner = isServer;

      if (!isServer && currentUserName && currentUserName.length >= 2) {
        if (orderNote.includes(currentUserName)) {
          isOwner = true;
        }
      }

      // If not the owner who created this entry, show exact notification
      if (!isOwner) {
        showAlert(
          'warning',
          'Akses Ditolak',
          'akun anda tidak bisa merubah data akun lain, anda hanya bisa mengubah akun input anda sendiri'
        );
        return;
      }
    }

    setEditOrderId(orderId);
  };

  const handleDeleteOrder = async (orderId: string) => {
    const targetOrder = orders.find((o) => String(o.id) === String(orderId));

    if (targetOrder && user) {
      const isServer = role === 'server';
      const currentUserName = (user.name || '').toLowerCase().trim();
      const orderNote = (targetOrder.note || '').toLowerCase().trim();

      let isOwner = isServer;

      if (!isServer && currentUserName && currentUserName.length >= 2) {
        if (orderNote.includes(currentUserName)) {
          isOwner = true;
        }
      }

      // If not the owner who created this entry, show exact notification
      if (!isOwner) {
        showAlert(
          'warning',
          'Akses Ditolak',
          'akun anda tidak bisa menghapus data akun lain, anda hanya bisa menghapus akun input anda sendiri'
        );
        return;
      }
    }

    showAlert('success', 'Memproses', `Menghapus transaksi ${orderId}...`);
    
    // Optimistically update local orders list
    setOrders((prev) => prev.filter((o) => String(o.id) !== String(orderId)));

    try {
      const res = await fetchGAS({ action: 'delete_order', id: orderId });
      if (res && (res.status === 'success' || res.result === 'success' || res.success)) {
        showAlert('success', 'Berhasil Dihapus', `Transaksi ${orderId} berhasil dihapus.`);
      } else {
        showAlert('success', 'Berhasil Dihapus', `Transaksi ${orderId} telah dihapus dari daftar.`);
      }
      handleFetchOrders();
    } catch (err: any) {
      console.warn('GAS Delete order error:', err);
      showAlert('success', 'Berhasil Dihapus', `Transaksi ${orderId} telah dihapus dari daftar.`);
      handleFetchOrders();
    }
  };

  const handleSelectOrderFromNotif = (orderId: string) => {
    setActiveView('gudang');
    setTransferHistoryInitialSearch(orderId);
  };

  // On initial mount if user exists
  useEffect(() => {
    if (user) {
      handleFetchOrders();
      if (allProducts.length === 0 && !isLoadingCatalog) {
        handleFetchCatalog();
      }
    }
  }, [user, handleFetchOrders, handleFetchCatalog, allProducts.length, isLoadingCatalog]);

  useEffect(() => {
    if (user && activeView === 'katalog' && allProducts.length === 0 && !isLoadingCatalog) {
      handleFetchCatalog();
    }
  }, [user, activeView, allProducts.length, isLoadingCatalog, handleFetchCatalog]);

  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} showAlert={showAlert} />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto min-h-screen flex flex-col relative">
      <Header
        user={user}
        role={role}
        activeView={activeView}
        setActiveView={setActiveView}
        orders={orders}
        onLogout={handleLogout}
        onSelectOrderFromNotif={handleSelectOrderFromNotif}
      />

      <main className="flex-1 relative">
        {activeView === 'katalog' && (
          <CatalogSection
            user={user}
            allProducts={allProducts}
            isLoadingCatalog={isLoadingCatalog}
            onRefreshCatalog={handleFetchCatalog}
            onRefreshOrders={handleFetchOrders}
            openImageZoom={(src, driveId) => setImageZoom({ src, driveId })}
            showAlert={showAlert}
          />
        )}

        {activeView === 'gudang' && (
          <TransferHistorySection
            user={user}
            role={role}
            orders={orders}
            isLoadingOrders={isLoadingOrders}
            onRefreshOrders={handleFetchOrders}
            openReceiveModal={(ids) => {
              setReceiveModalIds(ids);
              setIsReceiveModalOpen(true);
            }}
            openOrderDetail={(order) => setDetailOrder(order)}
            openImageZoom={(src, driveId) => setImageZoom({ src, driveId })}
            initialSearch={transferHistoryInitialSearch}
          />
        )}

        {activeView === 'riwayat-sku' && (
          <SkuHistorySection
            user={user}
            role={role}
            orders={orders}
            isLoadingOrders={isLoadingOrders}
            onRefreshOrders={handleFetchOrders}
            openEditOrderModal={handleOpenEditOrderModal}
            onDeleteOrder={handleDeleteOrder}
            openDiscrepancyModal={(group) => setDiscrepancySkuGroup(group)}
            openImageZoom={(src, driveId) => setImageZoom({ src, driveId })}
          />
        )}

        {activeView === 'upload-gambar' && role === 'server' && (
          <UploadImageSection
            onUploadSuccess={() => {
              handleFetchCatalog();
            }}
            showAlert={showAlert}
          />
        )}

        {activeView === 'google-workspace' && (
          <GoogleWorkspacePanel showAlert={showAlert} />
        )}
      </main>

      {/* Modals */}
      <ReceiveConfirmModal
        isOpen={isReceiveModalOpen}
        orderIds={receiveModalIds}
        orders={orders}
        user={user}
        onClose={() => setIsReceiveModalOpen(false)}
        onSuccess={handleFetchOrders}
        showAlert={showAlert}
      />

      <OrderDetailModal
        order={detailOrder}
        user={user}
        role={role}
        onClose={() => setDetailOrder(null)}
        onSuccess={handleFetchOrders}
        openImageZoom={(src, driveId) => setImageZoom({ src, driveId })}
        showAlert={showAlert}
      />

      <EditOrderModal
        orderId={editOrderId}
        orders={orders}
        user={user}
        role={role}
        onClose={() => setEditOrderId(null)}
        onSuccess={handleFetchOrders}
        showAlert={showAlert}
      />

      <DiscrepancyModal
        skuGroup={discrepancySkuGroup}
        onClose={() => setDiscrepancySkuGroup(null)}
        onOpenOrderDetail={(id) => {
          const o = orders.find((ord) => String(ord.id) === String(id));
          if (o) setDetailOrder(o);
        }}
      />

      <ImageZoomModal
        src={imageZoom.src}
        driveId={imageZoom.driveId}
        onClose={() => setImageZoom({ src: null })}
      />

      <AlertModal state={alertState} onClose={closeAlert} />
    </div>
  );
}

export default App;

