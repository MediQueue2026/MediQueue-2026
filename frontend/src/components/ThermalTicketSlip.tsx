import React, { useState } from 'react';
import { Printer, X, QrCode } from 'lucide-react';

export interface ThermalTicketData {
  tokenNumber: string;
  patientName: string;
  doctorName?: string;
  room?: string;
  centerName?: string;
  dept?: string;
  phone?: string;
  issuedAt?: string | Date;
}

interface ThermalTicketSlipProps {
  ticket: ThermalTicketData | null;
  isOpen: boolean;
  onClose: () => void;
  defaultPaperWidth?: '80mm' | '58mm';
}

export const ThermalTicketSlip: React.FC<ThermalTicketSlipProps> = ({
  ticket,
  isOpen,
  onClose,
  defaultPaperWidth = '80mm'
}) => {
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>(defaultPaperWidth);

  if (!isOpen || !ticket) return null;

  const handlePrint = () => {
    document.body.classList.add('printing-thermal');
    window.print();
    // Remove class after print dialog closes
    setTimeout(() => {
      document.body.classList.remove('printing-thermal');
    }, 500);
  };

  const formattedDate = ticket.issuedAt
    ? new Date(ticket.issuedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

  const formattedTime = ticket.issuedAt
    ? new Date(ticket.issuedAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    : new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

  return (
    <div className="thermal-modal-container fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="thermal-modal-card bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
        <div className="no-print flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800">Thermal Token Slip</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-md text-xs font-medium">
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2 py-0.5 rounded ${paperWidth === '80mm' ? 'bg-white text-teal-700 shadow-xs font-bold' : 'text-slate-500'}`}
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-2 py-0.5 rounded ${paperWidth === '58mm' ? 'bg-white text-teal-700 shadow-xs font-bold' : 'text-slate-500'}`}
              >
                58mm
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Thermal Slip Preview / Printable Node */}
        <div className="thermal-slip-wrapper my-4 flex justify-center bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
          <div
            id="thermal-ticket-slip"
            className={`thermal-slip ${paperWidth === '58mm' ? 'slip-58mm' : ''}`}
            style={{ border: '1px solid #111', background: '#fff' }}
          >
            {/* Header */}
            <div className="font-bold text-sm tracking-wider uppercase mb-1">
              {ticket.centerName || 'MediQueue Medical Center'}
            </div>
            <div className="text-[10px] text-slate-600 border-b border-dashed border-slate-400 pb-2 mb-2">
              Walk-in Consultation Slip · {formattedDate}
            </div>

            {/* Token Number */}
            <div className="py-2 my-1 border-y-2 border-black">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">YOUR TOKEN</div>
              <div className="text-4xl font-extrabold font-mono tracking-tight text-black my-1">
                {ticket.tokenNumber}
              </div>
              <div className="text-[10px] text-slate-600">Please watch the TV Board</div>
            </div>

            {/* Details */}
            <div className="text-left text-xs space-y-1.5 my-3 pt-1 border-b border-dashed border-slate-400 pb-3">
              <div className="flex justify-between">
                <span className="text-slate-500 text-[11px]">Patient:</span>
                <span className="font-bold text-black text-right max-w-[150px] truncate">{ticket.patientName}</span>
              </div>
              {ticket.doctorName && (
                <div className="flex justify-between">
                  <span className="text-slate-500 text-[11px]">Doctor:</span>
                  <span className="font-bold text-black text-right max-w-[150px] truncate">{ticket.doctorName}</span>
                </div>
              )}
              {ticket.room && (
                <div className="flex justify-between">
                  <span className="text-slate-500 text-[11px]">Consultation Room:</span>
                  <span className="font-bold text-black">Room {ticket.room}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 text-[11px]">Issued Time:</span>
                <span className="font-mono text-[11px] text-black">{formattedTime}</span>
              </div>
            </div>

            {/* Simulated QR Code placeholder for Slip */}
            <div className="flex flex-col items-center justify-center my-2">
              <div className="w-16 h-16 border border-black p-1 flex items-center justify-center bg-white">
                <QrCode className="w-12 h-12 text-black" />
              </div>
              <span className="text-[9px] text-slate-500 mt-1 uppercase font-mono">
                {ticket.tokenNumber}-{formattedDate.replace(/\s+/g, '')}
              </span>
            </div>

            {/* Footer */}
            <div className="text-[10px] text-slate-600 border-t border-dashed border-slate-400 pt-2 mt-2 leading-tight">
              <div>Thank you for choosing {ticket.centerName || 'us'}.</div>
              <div className="text-[9px] text-slate-400 mt-0.5">Powered by MediQueue Cloud</div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="no-print flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Slip (Ctrl+P)
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThermalTicketSlip;
