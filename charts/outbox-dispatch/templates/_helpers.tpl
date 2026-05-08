{{- define "outbox-dispatch.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "outbox-dispatch.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- include "outbox-dispatch.name" . | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "outbox-dispatch.configMapName" -}}
{{- printf "%s-config" (include "outbox-dispatch.fullname" .) -}}
{{- end -}}

{{- define "outbox-dispatch.secretName" -}}
{{- if .Values.secret.existingSecret -}}
{{- .Values.secret.existingSecret -}}
{{- else -}}
{{- printf "%s-secrets" (include "outbox-dispatch.fullname" .) -}}
{{- end -}}
{{- end -}}

{{- define "outbox-dispatch.postgresqlFullname" -}}
{{- printf "%s-postgres" (include "outbox-dispatch.fullname" .) -}}
{{- end -}}

{{- define "outbox-dispatch.postgresqlSecretName" -}}
{{- printf "%s-auth" (include "outbox-dispatch.postgresqlFullname" .) -}}
{{- end -}}

{{- define "outbox-dispatch.databaseUrl" -}}
{{- if .Values.secret.databaseUrl -}}
{{- .Values.secret.databaseUrl -}}
{{- else -}}
{{- printf "postgresql://%s:%s@%s:%v/%s?schema=public" .Values.postgresql.auth.username .Values.postgresql.auth.password (include "outbox-dispatch.postgresqlFullname" .) .Values.postgresql.service.port .Values.postgresql.auth.database -}}
{{- end -}}
{{- end -}}