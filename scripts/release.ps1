#Requires -Version 5.1
<#
.SYNOPSIS
    LineOps KDS — Release helper (Windows PowerShell)
    Wraps the TypeScript release script via pnpm.

.EXAMPLE
    .\scripts\release.ps1 patch
    .\scripts\release.ps1 minor
    .\scripts\release.ps1 major
    .\scripts\release.ps1 2.1.0
#>
param(
    [Parameter(Position=0, Mandatory=$true)]
    [string] $Bump
)

$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot
pnpm --filter @workspace/scripts run release -- $Bump
