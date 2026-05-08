{{- define "orchestration-jobs.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "orchestration-jobs.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- include "orchestration-jobs.name" . | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "orchestration-jobs.configMapName" -}}
{{- printf "%s-config" (include "orchestration-jobs.fullname" .) -}}
{{- end -}}

{{- define "orchestration-jobs.secretName" -}}
{{- if .Values.secret.existingSecret -}}
{{- .Values.secret.existingSecret -}}
{{- else -}}
{{- printf "%s-secrets" (include "orchestration-jobs.fullname" .) -}}
{{- end -}}
{{- end -}}