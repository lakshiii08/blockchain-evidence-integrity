import React, { useState } from "react";
import { Upload, X, ShieldCheck, FileText, CheckCircle, Loader2 } from "lucide-react";

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  apiBaseUrl: string;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  apiBaseUrl,
}) => {
  const [caseId, setCaseId] = useState("CASE-2026-FIR-101");
  const [evidenceId, setEvidenceId] = useState("EV-101");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clientHash, setClientHash] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setError(null);

      // Compute client-side SHA-256 fingerprint
      try {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        setClientHash(hashHex);
      } catch (err) {
        console.error("Error computing client-side hash", err);
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please select a digital evidence file to anchor.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("evidence_id", evidenceId);
    formData.append("case_id", caseId);
    formData.append("file", selectedFile);

    try {
      const res = await fetch(`${apiBaseUrl}/api/evidence/register`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to register evidence on blockchain");
      }

      const data = await res.json();
      setResult(data);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Anchor Digital Evidence</h2>
              <p className="text-xs text-slate-400">Cryptographic SHA-256 Blockchain Registration</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="p-8 space-y-6">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start space-x-4">
              <CheckCircle className="w-7 h-7 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-emerald-400 text-lg">
                  Blockchain Registration Successful
                </h3>
                <p className="text-sm text-slate-300 mt-1">
                  Evidence fingerprint anchored into smart contract on{" "}
                  <span className="font-medium text-white">{result.blockchain_network}</span>.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <p className="text-slate-500 text-xs uppercase font-medium">Evidence ID</p>
                <p className="font-semibold text-slate-200">{result.evidence_id} (v{result.version})</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase font-medium">Block Number</p>
                <p className="font-semibold text-slate-200">#{result.block_number || "Pending"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500 text-xs uppercase font-medium">SHA-256 Fingerprint</p>
                <p className="font-mono text-xs text-cyan-400 break-all bg-slate-900 p-2 rounded border border-slate-800 mt-1">
                  {result.sha256}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500 text-xs uppercase font-medium">Transaction Hash</p>
                <p className="font-mono text-xs text-indigo-300 break-all bg-slate-900 p-2 rounded border border-slate-800 mt-1">
                  {result.transaction_hash}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  setResult(null);
                  setSelectedFile(null);
                  setClientHash("");
                  onClose();
                }}
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium transition text-sm"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="p-6 space-y-5">
            {error && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Case Identifier
                </label>
                <input
                  type="text"
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Evidence Item ID
                </label>
                <input
                  type="text"
                  value={evidenceId}
                  onChange={(e) => setEvidenceId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                Upload Sensitive Evidence File (FIR, CDR, PDF, Media)
              </label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-cyan-500/50 rounded-2xl p-6 cursor-pointer bg-slate-950/60 transition group">
                <Upload className="w-8 h-8 text-slate-500 group-hover:text-cyan-400 transition mb-2" />
                <span className="text-sm font-medium text-slate-300 group-hover:text-white">
                  {selectedFile ? selectedFile.name : "Click to select or drag and drop evidence file"}
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  File content remains private off-chain; only SHA-256 fingerprint is recorded.
                </span>
                <input type="file" onChange={handleFileChange} className="hidden" />
              </label>
            </div>

            {clientHash && (
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <p className="text-xs font-semibold text-slate-400 uppercase">Pre-Computed SHA-256</p>
                <p className="font-mono text-xs text-cyan-400 break-all mt-1">{clientHash}</p>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-400 hover:text-white text-sm transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition shadow-lg shadow-cyan-900/30"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Anchoring on-chain...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Register on Blockchain</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
