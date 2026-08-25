import React from "react";
import { CheckCircle2, AlertTriangle, X, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";

interface VerificationResult {
  evidence_id: str;
  version: number;
  current_hash: string;
  registered_hash: string;
  integrity_status: string;
  is_match: boolean;
  verified_at: string;
  blockchain_network: string;
  contract_address?: string;
  transaction_hash?: string;
  block_number?: number;
  explanation: string;
  explorer_url?: string;
}

interface VerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: VerificationResult | null;
  onFlagForReview?: (evidenceId: string) => void;
}

export const VerifyModal: React.FC<VerifyModalProps> = ({
  isOpen,
  onClose,
  result,
  onFlagForReview,
}) => {
  if (!isOpen || !result) return null;

  const isVerified = result.is_match;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center space-x-3">
            {isVerified ? (
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
            ) : (
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                <ShieldAlert className="w-6 h-6" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">Cryptographic Integrity Audit</h2>
              <p className="text-xs text-slate-400">
                Evidence ID: <span className="text-slate-200 font-medium">{result.evidence_id} (v{result.version})</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Status Alert Banner */}
          {isVerified ? (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-start space-x-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-emerald-400 text-base">✓ VERIFIED - INTEGRITY CONFIRMED</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{result.explanation}</p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-xl flex items-start space-x-4">
              <AlertTriangle className="w-7 h-7 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-400 text-base">⚠ POTENTIAL INTEGRITY MISMATCH</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{result.explanation}</p>
              </div>
            </div>
          )}

          {/* Side-by-Side Fingerprint Comparison */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
              Cryptographic Fingerprint Audit
            </h4>
            
            <div className="space-y-2">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                  <span className="font-semibold text-slate-300">Registered On-Chain Hash (Smart Contract)</span>
                  <span className="text-cyan-400">Polygon Amoy Anchor</span>
                </div>
                <p className="font-mono text-xs text-cyan-300 break-all">{result.registered_hash}</p>
              </div>

              <div
                className={`bg-slate-950 p-3.5 rounded-xl border ${
                  isVerified ? "border-slate-800" : "border-amber-500/40 bg-amber-950/10"
                }`}
              >
                <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                  <span className="font-semibold text-slate-300">Current Computed File Hash</span>
                  <span className={isVerified ? "text-emerald-400" : "text-amber-400 font-medium"}>
                    {isVerified ? "Matches" : "Mismatched"}
                  </span>
                </div>
                <p
                  className={`font-mono text-xs break-all ${
                    isVerified ? "text-slate-300" : "text-amber-300 font-semibold"
                  }`}
                >
                  {result.current_hash}
                </p>
              </div>
            </div>
          </div>

          {/* Blockchain Provenance Details */}
          <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
            <div>
              <p className="text-slate-500 font-medium uppercase">Network</p>
              <p className="text-slate-200 font-semibold mt-0.5">{result.blockchain_network}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium uppercase">Block Number</p>
              <p className="text-slate-200 font-semibold mt-0.5">
                {result.block_number ? `#${result.block_number}` : "N/A"}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-500 font-medium uppercase">Transaction Receipt</p>
              <p className="font-mono text-slate-300 break-all mt-0.5">
                {result.transaction_hash || "Simulated local anchor"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            {result.explorer_url ? (
              <a
                href={result.explorer_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center space-x-1.5 text-xs text-cyan-400 hover:text-cyan-300 underline"
              >
                <span>View on Block Explorer</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : <div />}

            <div className="flex items-center space-x-3">
              {!isVerified && onFlagForReview && (
                <button
                  onClick={() => onFlagForReview(result.evidence_id)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl transition"
                >
                  Flag for Review
                </button>
              )}
              <button
                onClick={onClose}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
