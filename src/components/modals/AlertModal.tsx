import React from 'react';
import { AlertModalState } from '../../types';
import { Check, AlertTriangle } from 'lucide-react';

interface AlertModalProps {
  state: AlertModalState;
  onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({ state, onClose }) => {
  if (!state.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl">
        <div
          className={`mx-auto w-16 h-16 flex items-center justify-center rounded-2xl mb-6 shadow-inner ${
            state.type === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'
          }`}
        >
          {state.type === 'success' ? (
            <Check className="w-8 h-8 stroke-[3]" />
          ) : (
            <AlertTriangle className="w-8 h-8 stroke-[3]" />
          )}
        </div>
        <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">{state.title}</h3>
        <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed whitespace-pre-line">{state.message}</p>
        <button
          onClick={onClose}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-slate-800 transition-colors tracking-wider text-sm cursor-pointer"
        >
          MENGERTI
        </button>
      </div>
    </div>
  );
};
