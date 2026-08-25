import React from "react";
import { CheckCircle, Clock, ShieldCheck, X, FileCheck, Layers } from "lucide-react";

interface ProvenanceEvent {
  step_number: number;
  stage: string;
  description: string;
  timestamp: string;
  actor: string;
  details: Record<string, any>;
}

interface ProvenanceData {
  evidence_id: string;
  case_id: string;
  current_version: number;
  sha256_hash: string;
  status: string;
  timeline: ProvenanceEvent[];
  verification_history: Array<{
    id: number;
    version: number;
    integrity_status: string;
    is_match: boolean;
    calculated_hash: string;
    expected_hash: string;
    verified_at: string;
    verified_by: string;
  }>;
}

interface ProvenanceTimelineProps {
  isOpen: boolean;
  onClose: () => void;
  data: ProvenanceData | null;
}

export const ProvenanceTimeline: React.FC<ProvenanceTimelineProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Immutable Provenance Trail</h2>
              <p className="text-xs text-slate-400">
                Case: <span className="text-slate-200">{data.case_id}</span> | Evidence:{" "}
                <span className="text-cyan-400 font-medium">{data.evidence_id}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Timeline */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="space-y-6 relative before:absolute before:inset-0 before:left-4 before:h-full before:w-0.5 before:bg-slate-800">
            {data.timeline.map((event) => (
              <div key={event.step_number} className="relative flex items-start space-x-4 pl-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 border-2 border-cyan-500 text-cyan-400 font-bold text-xs shrink-0 z-10 shadow">
                  {event.step_number}
                </div>
                <div className="flex-1 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
                      {event.stage.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(event.timestamp).toLocaleString()}</span>
                    </span>
                  </div>

                  <p className="text-sm text-slate-200 font-medium mt-2">{event.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Authorized Actor: <span className="text-slate-300 font-medium">{event.actor}</span>
                  </p>

                  {event.details && (
                    <div className="mt-3 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 space-y-1">
                      {Object.entries(event.details).map(([key, val]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-slate-500 uppercase">{key}:</span>
                          <span className="text-cyan-300 break-all text-right ml-4">
                            {typeof val === "boolean" ? (val ? "true" : "false") : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Verification History Table */}
          {data.verification_history.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-800">
              <h3 className="text-sm font-semibold uppercase text-slate-400 mb-3 flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-cyan-400" />
                <span>Verification Audit History ({data.verification_history.length})</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-800 rounded-xl overflow-hidden">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Time</th>
                      <th className="p-2.5">Auditor</th>
                      <th className="p-2.5">Version</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {data.verification_history.map((log) => (
                      <tr key={log.id} className="bg-slate-900/50">
                        <td className="p-2.5 text-slate-400">{new Date(log.verified_at).toLocaleTimeString()}</td>
                        <td className="p-2.5 text-slate-300 font-medium">{log.verified_by}</td>
                        <td className="p-2.5 text-slate-300">v{log.version}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              log.is_match
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {log.integrity_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition"
          >
            Close Provenance
          </button>
        </div>
      </div>
    </div>
  );
};
