import React, { useState, useEffect } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Layers,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  FileText,
  Lock,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { RegisterModal } from "@/components/RegisterModal";
import { VerifyModal } from "@/components/VerifyModal";
import { ProvenanceTimeline } from "@/components/ProvenanceTimeline";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function EvidenceDashboard() {
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "verified" | "mismatch">("all");

  // Modals state
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any | null>(null);
  const [provenanceData, setProvenanceData] = useState<any | null>(null);
  const [tamperFeedback, setTamperFeedback] = useState<string | null>(null);

  const fetchEvidence = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/evidence`);
      if (res.ok) {
        const data = await res.json();
        setEvidenceList(data);
      }
    } catch (err) {
      console.error("Failed to fetch evidence list:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidence();
  }, []);

  const handleVerify = async (evidenceId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/evidence/${evidenceId}/verify`);
      const data = await res.json();
      setVerifyResult(data);
    } catch (err) {
      console.error("Verification error:", err);
    }
  };

  const handleViewProvenance = async (evidenceId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/evidence/${evidenceId}/provenance`);
      const data = await res.json();
      setProvenanceData(data);
    } catch (err) {
      console.error("Provenance query error:", err);
    }
  };

  const handleSimulateTamper = async (evidenceId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/demo/simulate-tamper/${evidenceId}`, {
        method: "POST",
      });
      const data = await res.json();
      setTamperFeedback(`Tampering simulated on ${evidenceId}: 1 byte altered in server storage. Run verification now!`);
      // Automatically trigger verification after tamper to show mismatch immediately
      setTimeout(() => {
        handleVerify(evidenceId);
      }, 500);
    } catch (err) {
      console.error("Tampering simulation failed:", err);
    }
  };

  const handleRestoreFile = async (evidenceId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/demo/restore-file/${evidenceId}`, {
        method: "POST",
      });
      setTamperFeedback(`Original file restored for ${evidenceId}.`);
      handleVerify(evidenceId);
    } catch (err) {
      console.error("Restore failed:", err);
    }
  };

  const filteredEvidence = evidenceList.filter(
    (item) =>
      item.evidence_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.case_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/30">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-white tracking-wide">
                  Evidence Integrity & Provenance Ledger
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Polygon Amoy EVM
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cryptographic SHA-256 Digital Fingerprint Anchoring for Law Enforcement & Forensics
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchEvidence}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            </button>
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="flex items-center space-x-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-cyan-900/30 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Anchor New Evidence</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
        {/* Tamper Feedback Alert */}
        {tamperFeedback && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-amber-300 text-xs animate-in fade-in">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>{tamperFeedback}</span>
            </div>
            <button
              onClick={() => setTamperFeedback(null)}
              className="text-amber-400 hover:text-white font-medium underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-semibold">Total Anchored Items</span>
              <FileText className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-bold text-white mt-2">{evidenceList.length}</p>
            <p className="text-[11px] text-slate-500 mt-1">Multi-source evidence hashes</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-semibold">Blockchain Network</span>
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-lg font-bold text-indigo-300 mt-2">Polygon Amoy / Local</p>
            <p className="text-[11px] text-slate-500 mt-1">Solidity 0.8.28 + EDR / PoS</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-semibold">Privacy Boundary</span>
              <Lock className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-lg font-bold text-emerald-400 mt-2">Zero-PII On-Chain</p>
            <p className="text-[11px] text-slate-500 mt-1">Raw files remain encrypted off-chain</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-semibold">Integrity Protocol</span>
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-lg font-bold text-cyan-400 mt-2">SHA-256 (bytes32)</p>
            <p className="text-[11px] text-slate-500 mt-1">Immutable version history</p>
          </div>
        </div>

        {/* Evidence Registry Table Section */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Table Controls */}
          <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/40">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Case ID, Evidence ID, or File..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="text-xs text-slate-400 flex items-center space-x-2">
              <span>Showing {filteredEvidence.length} anchored evidence records</span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-4 font-semibold">Evidence / Case ID</th>
                  <th className="p-4 font-semibold">File & Version</th>
                  <th className="p-4 font-semibold">SHA-256 Fingerprint</th>
                  <th className="p-4 font-semibold">Anchor Receipt</th>
                  <th className="p-4 font-semibold">Registered At</th>
                  <th className="p-4 font-semibold text-right">Integrity Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {filteredEvidence.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 font-sans">
                      No evidence records found. Click &quot;Anchor New Evidence&quot; to register your first digital file.
                    </td>
                  </tr>
                ) : (
                  filteredEvidence.map((item) => (
                    <tr key={item.evidence_id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-sans">
                        <p className="font-bold text-white">{item.evidence_id}</p>
                        <p className="text-slate-400 text-[10px]">{item.case_id}</p>
                      </td>
                      <td className="p-4 font-sans">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-200 font-medium">{item.file_name}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-cyan-400 border border-slate-700">
                            v{item.version}
                          </span>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-sans">
                          ● {item.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 max-w-xs" title={item.sha256}>
                          <span className="text-cyan-400 truncate text-[10px]">{item.sha256}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <p className="text-slate-300 font-medium text-[10px]">
                            Block #{item.block_number || "Pending"}
                          </p>
                          <p className="text-slate-500 truncate max-w-[120px] text-[10px]" title={item.transaction_hash}>
                            {item.transaction_hash}
                          </p>
                        </div>
                      </td>
                      <td className="p-4 font-sans text-slate-400 text-[11px]">
                        {new Date(item.registered_at).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="p-4 text-right font-sans space-x-2">
                        <button
                          onClick={() => handleVerify(item.evidence_id)}
                          className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition"
                        >
                          Verify Integrity
                        </button>
                        <button
                          onClick={() => handleViewProvenance(item.evidence_id)}
                          className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold transition"
                        >
                          Provenance
                        </button>
                        <button
                          onClick={() => handleSimulateTamper(item.evidence_id)}
                          className="px-2.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold transition"
                          title="Simulate 1-byte storage tampering to test detection"
                        >
                          Simulate Tamper
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modals */}
      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={fetchEvidence}
        apiBaseUrl={API_BASE_URL}
      />

      <VerifyModal
        isOpen={!!verifyResult}
        onClose={() => setVerifyResult(null)}
        result={verifyResult}
        onFlagForReview={(id) => {
          alert(`Evidence item ${id} flagged for immediate forensic review.`);
          setVerifyResult(null);
        }}
      />

      <ProvenanceTimeline
        isOpen={!!provenanceData}
        onClose={() => setProvenanceData(null)}
        data={provenanceData}
      />
    </div>
  );
}
