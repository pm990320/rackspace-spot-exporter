{{/*
Expand the name of the chart.
*/}}
{{- define "rackspace-spot-exporter.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "rackspace-spot-exporter.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "rackspace-spot-exporter.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "rackspace-spot-exporter.labels" -}}
helm.sh/chart: {{ include "rackspace-spot-exporter.chart" . }}
{{ include "rackspace-spot-exporter.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "rackspace-spot-exporter.selectorLabels" -}}
app.kubernetes.io/name: {{ include "rackspace-spot-exporter.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "rackspace-spot-exporter.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "rackspace-spot-exporter.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the secret to use
*/}}
{{- define "rackspace-spot-exporter.secretName" -}}
{{- if .Values.rackspaceSpot.existingSecret }}
{{- .Values.rackspaceSpot.existingSecret }}
{{- else }}
{{- include "rackspace-spot-exporter.fullname" . }}
{{- end }}
{{- end }}
