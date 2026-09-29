import React, { useState } from 'react';
import { X } from 'lucide-react';

interface ImageZoomModalProps {
  src: string | null;
  driveId?: string;
  onClose: () => void;
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({ src, driveId, onClose }) => {
  const [retryCount, setRetryCount] = useState(0);

  if (!src) return null;

  let displaySrc = src;
  if (driveId) {
    if (retryCount === 0) {
      displaySrc = `https://lh3.googleusercontent.com/d/${driveId}`;
    } else if (retryCount === 1) {
      displaySrc = `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`;
    } else if (retryCount === 2) {
      displaySrc = `https://drive.google.com/uc?export=view&id=${driveId}`;
    } else {
      displaySrc = 'https://placehold.co/600x600/f8fafc/ef4444?text=Gagal+Memuat+Gambar';
    }
  }

  const handleError = () => {
    if (driveId && retryCount < 3) {
      setRetryCount((prev) => prev + 1);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 cursor-zoom-out animate-fade-in"
    >
      <div className="relative max-w-4xl w-full flex justify-center items-center">
        <img
          src={displaySrc}
          alt="Zoomed Product"
          referrerPolicy="no-referrer"
          onError={handleError}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90vh] max-w-full object-contain rounded-lg shadow-2xl cursor-default transition-transform duration-300"
        />
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-slate-300 p-2 cursor-pointer"
        >
          <X className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
};
