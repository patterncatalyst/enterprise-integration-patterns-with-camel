{{- define "chart.labels" -}}
app.kubernetes.io/part-of: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{/* Container hardening for restricted-v2: no runAsUser/runAsGroup/fsGroup,
     so OpenShift assigns a UID from the namespace range. */}}
{{- define "chart.containerSecurity" -}}
securityContext:
  runAsNonRoot: true
  allowPrivilegeEscalation: false
  capabilities:
    drop: ["ALL"]
  seccompProfile:
    type: RuntimeDefault
{{- end -}}

{{- define "chart.image" -}}
{{ .root.Values.registry }}/{{ .root.Release.Namespace }}/{{ .name }}:{{ .root.Values.imageTag }}
{{- end -}}

{{/* Pod template for one service. dict: root, name, svc */}}
{{- define "chart.podTemplate" -}}
{{- $ := .root -}}
{{- $name := .name -}}
{{- $svc := .svc -}}
metadata:
  labels:
    app.kubernetes.io/name: {{ $name }}
    app.kubernetes.io/part-of: {{ $.Release.Name }}
  annotations:
    # Env from a ConfigMap is read at pod start: roll the pods when it changes.
    checksum/config: {{ include (print $.Template.BasePath "/config.yaml") $ | sha256sum }}
    {{- if and $.Values.observability.enabled (ne (toString $svc.instrument) "false") }}
    instrumentation.opentelemetry.io/inject-java: "{{ $.Release.Name }}-java"
    {{- end }}
spec:
  containers:
    - name: {{ $name }}
      image: {{ include "chart.image" (dict "root" $ "name" $name) | quote }}
      imagePullPolicy: Always
      ports:
        - name: http
          containerPort: {{ $svc.port | default 8080 }}
      envFrom:
        - configMapRef:
            name: {{ $.Release.Name }}-app-config
      env:
        {{- if $svc.javaToolOptions }}
        - name: JAVA_TOOL_OPTIONS
          value: {{ $svc.javaToolOptions | quote }}
        {{- end }}
        {{- range $k, $v := $svc.env }}
        - name: {{ $k }}
          value: {{ $v | quote }}
        {{- end }}
      startupProbe:
        httpGet: {path: /q/health/started, port: http}
        initialDelaySeconds: 5
        periodSeconds: 5
        failureThreshold: 60
      readinessProbe:
        httpGet: {path: /q/health/ready, port: http}
        periodSeconds: 10
        failureThreshold: 3
      livenessProbe:
        httpGet: {path: /q/health/live, port: http}
        periodSeconds: 10
        failureThreshold: 3
      resources:
        {{- toYaml $svc.resources | nindent 8 }}
      {{- include "chart.containerSecurity" $ | nindent 6 }}
{{- end -}}
