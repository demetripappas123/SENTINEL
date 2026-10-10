# Runs every simulation in numeric order.
# Each script is safe to run on its own. Together they leave a pile of
# partial, contradictory, and rejected Orbit and Spot posts in the local DB.
# Refresh the web app afterward and open Review, Missions, and a mission detail.

$ErrorActionPreference = "Continue"
Get-ChildItem $PSScriptRoot -Filter "[0-9]*.ps1" |
    Sort-Object Name |
    ForEach-Object {
        Write-Host "`n######## $($_.Name) ########"
        & $_.FullName
    }
