# Configure la protection de la branche main + les réglages du repo nécessaires à l'auto-merge.
# Prérequis : gh CLI authentifié avec un compte admin du repo (`gh auth login`).
# Usage : powershell -ExecutionPolicy Bypass -File .github/setup-branch-protection.ps1

$ErrorActionPreference = 'Stop'
$repo = 'tristan-spinnewyn/serietracker'
$branch = 'main'

Write-Host "-> Réglages du repo (auto-merge, suppression des branches mergées)"
gh api -X PATCH "repos/$repo" `
  -F allow_auto_merge=true `
  -F delete_branch_on_merge=true `
  -F allow_update_branch=true | Out-Null

Write-Host "-> Protection de la branche $branch"
$body = @{
  # Le job "ci" (.github/workflows/ci.yml) doit être vert pour merger.
  required_status_checks        = @{
    strict = $false
    checks = @(@{ context = 'ci'; app_id = 15368 })  # 15368 = GitHub Actions
  }
  # S'applique aussi aux admins : plus de push direct sur main.
  enforce_admins                = $true
  # PR obligatoire, 0 approbation (repo solo : on ne peut pas approuver sa propre PR).
  required_pull_request_reviews = @{
    required_approving_review_count = 0
    dismiss_stale_reviews           = $false
  }
  restrictions                  = $null
  allow_force_pushes            = $false
  allow_deletions               = $false
} | ConvertTo-Json -Depth 5

$body | gh api -X PUT "repos/$repo/branches/$branch/protection" --input - | Out-Null

Write-Host "OK. Vérification :"
gh api "repos/$repo/branches/$branch/protection" --jq '{checks: .required_status_checks.checks, enforce_admins: .enforce_admins.enabled, pr_required: (.required_pull_request_reviews != null)}'
