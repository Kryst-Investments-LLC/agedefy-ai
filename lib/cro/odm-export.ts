/**
 * CDISC ODM-XML export.
 *
 * Emits a minimal but valid CDISC ODM v1.3 document for a NofOneTrial so
 * external CRO / EDC systems can import the protocol. This is the
 * "outbound" half of the wet-lab bridge; inbound reconciliation is in
 * `lib/cro/reconcile.ts`.
 */

import { db } from "@/lib/db"

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export async function generateOdmForTrial(trialId: string): Promise<string> {
  const trial = await db.nofOneTrial.findUnique({
    where: { id: trialId },
    include: { arms: true, periods: { orderBy: { orderIndex: "asc" } } },
  })
  if (!trial) throw new Error(`NofOneTrial ${trialId} not found`)

  const studyOid = `STUDY.${trial.id}`
  const fileOid = `ODM.${trial.id}.${Date.now()}`
  const created = new Date().toISOString()

  const armDefs = trial.arms
    .map(
      (a) =>
        `<StudyEventDef OID="ARM.${a.id}" Name="${escapeXml(a.label)}" Repeating="No" Type="Scheduled" />`,
    )
    .join("\n      ")

  const periodRefs = trial.periods
    .map(
      (p) =>
        `<StudyEventRef StudyEventOID="ARM.${p.armLabel}" OrderNumber="${p.orderIndex}" Mandatory="Yes" />`,
    )
    .join("\n        ")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ODM xmlns="http://www.cdisc.org/ns/odm/v1.3"
     ODMVersion="1.3.2"
     FileOID="${fileOid}"
     FileType="Snapshot"
     CreationDateTime="${created}">
  <Study OID="${studyOid}">
    <GlobalVariables>
      <StudyName>${escapeXml(trial.hypothesis.slice(0, 120))}</StudyName>
      <StudyDescription>N-of-1 trial: ${escapeXml(trial.hypothesis)}</StudyDescription>
      <ProtocolName>NofOneTrial.${trial.id}</ProtocolName>
    </GlobalVariables>
    <MetaDataVersion OID="MDV.1" Name="${escapeXml(trial.design)}">
      <Protocol>
        ${periodRefs}
      </Protocol>
      ${armDefs}
    </MetaDataVersion>
  </Study>
</ODM>`

  await db.cdiscOdmExport.create({
    data: {
      tenantId: "default",
      trialId: trial.id,
      studyOid,
      documentXml: xml,
    },
  })
  return xml
}
