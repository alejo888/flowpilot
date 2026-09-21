import { AiProvider } from '../board/board.model';

export type RiskSignalType =
  | 'LARGE_STORY'
  | 'OVERLOADED_MEMBER'
  | 'SPRINT_AT_RISK'
  | 'SPRINT_OVERDUE'
  | 'STALLED_ITEM'
  | 'UNASSIGNED_HIGH_PRIORITY';

export type RiskSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

/** One deterministic risk signal computed by the backend. */
export interface RiskSignal {
  type: RiskSignalType;
  severity: RiskSeverity;
  title: string;
  detail: string;
  workItemId?: number | null;
  userId?: number | null;
}

/** Non-persisted AI risk analysis (vision 7.6). */
export interface RiskAnalysisResponse {
  signals: RiskSignal[];
  summary: string;
  recommendations: string[];
  generatedBy: AiProvider;
  model: string | null;
}
