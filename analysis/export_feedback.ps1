param(
  [string]$DatabaseName = "acgti-stats",
  [string]$OutputDir = "analysis/backup",
  [switch]$Local
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$date = Get-Date -Format "yyyy-MM-dd"
$scopeArgs = @()
if (-not $Local) {
  $scopeArgs += "--remote"
}

function Export-D1Table {
  param(
    [string]$TableName,
    [string]$OutputPath
  )

  Write-Host "Exporting table $TableName -> $OutputPath"
  & npx wrangler d1 export $DatabaseName @scopeArgs --table=$TableName --no-schema --output=$OutputPath
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Skipped $TableName because wrangler returned exit code $LASTEXITCODE."
  }
}

$fullPath = Join-Path $OutputDir "full_$date.sql"
Write-Host "Exporting full database -> $fullPath"
& npx wrangler d1 export $DatabaseName @scopeArgs --output=$fullPath
if ($LASTEXITCODE -ne 0) {
  throw "Full D1 export failed with exit code $LASTEXITCODE."
}

Export-D1Table "mbti_feedback" (Join-Path $OutputDir "mbti_feedback_data_$date.sql")
Export-D1Table "submissions_sampled" (Join-Path $OutputDir "submissions_sampled_data_$date.sql")
Export-D1Table "submission_answers_blob" (Join-Path $OutputDir "submission_answers_blob_data_$date.sql")

# Legacy tables kept for older exports and local databases.
Export-D1Table "submissions" (Join-Path $OutputDir "submissions_data_$date.sql")
Export-D1Table "submission_answers" (Join-Path $OutputDir "submission_answers_data_$date.sql")

Write-Host "Done. Backups are in $OutputDir"
