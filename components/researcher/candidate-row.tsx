'use client'

import { useState } from 'react'
import { ChevronDown, ExternalLink, CheckCircle, XCircle, AlertCircle, HelpCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SourceBadge } from '@/components/ui/source-badge'
import { AnnotatedValueDisplay } from '@/components/ui/annotated-value'
import { ScoreBreakdown } from '@/components/ui/score-breakdown'
import { ValidationStub } from './validation-stub'
import type { ResearcherCandidate, ValidationStatus } from './types'
import type { RealityCheckStatus } from '@/lib/services/candidate-reality-check'

// ── Reality-check badge ───────────────────────────────────────────────────────

const REALITY_CONFIG: Record<RealityCheckStatus, { label: string; icon: React.ReactNode; cls: string }> = {
  PENDING: {
    label: 'Checking…',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    cls: 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400',
  },
  KNOWN_COMPOUND: {
    label: 'Known compound',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
    cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  },
  NOT_FOUND_IN_DATABASES: {
    label: 'Not in databases',
    icon: <XCircle className="h-3.5 w-3.5" />,
    cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  },
  UNRESOLVABLE: {
    label: 'Unresolvable',
    icon: <HelpCircle className="h-3.5 w-3.5" />,
    cls: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
  },
}

function RealityCheckBadge({ status }: { status: RealityCheckStatus }) {
  const cfg = REALITY_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

// ── Filter dot ────────────────────────────────────────────────────────────────

function FilterDot({ pass, label }: { pass: boolean; label: string }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${pass ? 'bg-green-500' : 'bg-red-400'}`}
      title={`${label}: ${pass ? 'pass' : 'fail'}`}
    />
  )
}

// ── CandidateRow ─────────────────────────────────────────────────────────────

interface CandidateRowProps {
  candidate: ResearcherCandidate
  rank: number
  validationStatus: ValidationStatus
  onQueue: () => void
}

export function CandidateRow({ candidate, rank, validationStatus, onQueue }: CandidateRowProps) {
  const [expanded, setExpanded] = useState(false)

  const isChembl = candidate.kind === 'chembl'
  const name = isChembl
    ? (candidate.hit.preferredName ?? candidate.hit.chemblId)
    : (candidate.mol.commonName ?? candidate.mol.iupacName)
  const smiles = isChembl ? candidate.hit.canonicalSmiles : candidate.mol.smiles
  const screen = candidate.screen
  const dock = candidate.dock

  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden">
      {/* Summary row */}
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="text-xs font-mono text-muted-foreground w-5 flex-shrink-0">#{rank}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{name}</span>
            {isChembl ? (
              <Badge variant="outline" className="text-xs font-mono">
                {candidate.hit.chemblId}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">AI hypothesis</Badge>
            )}
            {isChembl && candidate.realityCheck && (
              <RealityCheckBadge status={candidate.realityCheck.status} />
            )}
            {!isChembl && candidate.mol.realityCheck && (
              <RealityCheckBadge status={candidate.mol.realityCheck.status} />
            )}
          </div>

          {smiles && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
              {smiles.length > 60 ? `${smiles.slice(0, 60)}…` : smiles}
            </p>
          )}
        </div>

        {/* Composite score */}
        {isChembl && (
          <span className="text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-400 flex-shrink-0">
            {(candidate.hit.score * 100).toFixed(0)}
          </span>
        )}

        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-slate-800 space-y-4">

          {/* Score breakdown (ChEMBL hits) */}
          {isChembl && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Score breakdown</p>
              <ScoreBreakdown breakdown={candidate.hit.scoreBreakdown} />
              <div className="flex items-center gap-1.5 mt-1">
                <SourceBadge kind={candidate.hit.propertySource.kind} />
                {candidate.hit.chemblVersion && (
                  <span className="text-xs text-muted-foreground">v{candidate.hit.chemblVersion}</span>
                )}
              </div>
            </div>
          )}

          {/* Annotated values (AI candidates) */}
          {!isChembl && (
            <div className="space-y-2">
              {candidate.mol.estimatedHealthspanGainAnnotated ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Healthspan gain estimate</p>
                  <AnnotatedValueDisplay
                    annotated={candidate.mol.estimatedHealthspanGainAnnotated}
                    format={(v) => `+${v.toFixed(0)}`}
                  />
                </div>
              ) : candidate.mol.estimatedHealthspanGain != null ? (
                <p className="text-xs">
                  Healthspan gain: <span className="font-medium">+{candidate.mol.estimatedHealthspanGain}d</span>
                  <SourceBadge kind="llm" className="ml-1" />
                </p>
              ) : null}

              {candidate.mol.safetyProfileAnnotated ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Toxicity estimate</p>
                  <AnnotatedValueDisplay
                    annotated={candidate.mol.safetyProfileAnnotated.toxicity}
                    format={(v) => `${(v * 100).toFixed(0)}%`}
                  />
                </div>
              ) : (
                <p className="text-xs">
                  Toxicity: <span className="font-medium">{(candidate.mol.safetyProfile.toxicity * 100).toFixed(0)}%</span>
                  <SourceBadge kind="llm" className="ml-1" />
                </p>
              )}

              {candidate.mol.mechanism && (
                <p className="text-xs text-muted-foreground">{candidate.mol.mechanism}</p>
              )}
            </div>
          )}

          {/* Physicochemical properties (ChEMBL) */}
          {isChembl && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {candidate.hit.molecularWeight != null && (
                <div>
                  <span className="text-muted-foreground">MW</span>
                  <span className="ml-1 font-medium">{candidate.hit.molecularWeight.toFixed(1)} g/mol</span>
                </div>
              )}
              {candidate.hit.logp != null && (
                <div>
                  <span className="text-muted-foreground">LogP</span>
                  <span className="ml-1 font-medium">{candidate.hit.logp.toFixed(2)}</span>
                </div>
              )}
              {candidate.hit.bestPchemblValue != null && (
                <div>
                  <span className="text-muted-foreground">pChEMBL</span>
                  <span className="ml-1 font-medium">{candidate.hit.bestPchemblValue.toFixed(1)}</span>
                </div>
              )}
              {candidate.hit.maxClinicalPhase != null && (
                <div>
                  <span className="text-muted-foreground">Phase</span>
                  <span className="ml-1 font-medium">{candidate.hit.maxClinicalPhase}</span>
                </div>
              )}
            </div>
          )}

          {/* Screening results */}
          {screen && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                Screening
                <SourceBadge kind="screening-sidecar" />
              </p>
              {screen.descriptors && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
                  <div>
                    <span className="text-muted-foreground">QED</span>
                    <span className="ml-1 font-medium">{screen.descriptors.qed.toFixed(2)}</span>
                  </div>
                  {screen.descriptors.sa_score != null && (
                    <div>
                      <span className="text-muted-foreground">SA</span>
                      <span className="ml-1 font-medium">{screen.descriptors.sa_score.toFixed(1)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">MW</span>
                    <span className="ml-1 font-medium">{screen.descriptors.molecular_weight.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">LogP</span>
                    <span className="ml-1 font-medium">{screen.descriptors.mol_log_p.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {screen.filters && (
                <div className="flex items-center gap-3 flex-wrap text-xs">
                  <span className="text-muted-foreground">Filters:</span>
                  <span className="flex items-center gap-1">
                    <FilterDot pass={screen.filters.lipinski.pass} label="Lipinski" />
                    Lipinski
                  </span>
                  <span className="flex items-center gap-1">
                    <FilterDot pass={screen.filters.veber.pass} label="Veber" />
                    Veber
                  </span>
                  <span className="flex items-center gap-1">
                    <FilterDot pass={screen.filters.ghose.pass} label="Ghose" />
                    Ghose
                  </span>
                  {screen.filters.pains.checked && (
                    <span className="flex items-center gap-1">
                      <FilterDot pass={screen.filters.pains.pass} label="PAINS-free" />
                      PAINS-free
                    </span>
                  )}
                </div>
              )}

              {screen.admet_flags && (
                <div className="flex items-center gap-3 flex-wrap text-xs mt-1.5">
                  <span className="text-muted-foreground">ADMET:</span>
                  <span className="flex items-center gap-1">
                    <FilterDot
                      pass={screen.admet_flags.oral_absorption_risk.flag !== true}
                      label="Low oral risk"
                    />
                    Oral
                  </span>
                  <span className="flex items-center gap-1">
                    <FilterDot
                      pass={screen.admet_flags.bbb_penetrant.likely === true}
                      label="BBB penetrant"
                    />
                    BBB
                  </span>
                  <span className="flex items-center gap-1">
                    <FilterDot
                      pass={screen.admet_flags.herg_liability_risk.flag !== true}
                      label="Low hERG risk"
                    />
                    hERG-safe
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Docking results */}
          {dock && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                Docking
                <SourceBadge kind="openmm-sidecar" />
              </p>
              <p className="text-xs">
                <span className="text-muted-foreground">Binding affinity: </span>
                <span className="font-medium">{dock.binding_affinity_kcal_mol.toFixed(2)} kcal/mol</span>
              </p>
              {dock.model_version && (
                <p className="text-xs text-muted-foreground">model {dock.model_version}</p>
              )}
            </div>
          )}

          {/* Known targets (reality check, ChEMBL) */}
          {isChembl &&
            candidate.realityCheck?.status === 'KNOWN_COMPOUND' &&
            candidate.realityCheck.topTargets &&
            candidate.realityCheck.topTargets.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Known targets</p>
                <div className="flex flex-wrap gap-1">
                  {candidate.realityCheck.topTargets.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

          {/* ChEMBL link */}
          {isChembl && (
            <a
              href={candidate.hit.chemblUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              View on ChEMBL
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {/* Validation action */}
          <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
            <ValidationStub
              candidateName={name ?? 'Unknown compound'}
              status={validationStatus}
              onQueue={onQueue}
            />
          </div>
        </div>
      )}
    </div>
  )
}
