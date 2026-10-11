# Shared poster for the simulation scripts.
# API base: $env:SENTINEL_API_URL or http://127.0.0.1:8000
# These scripts write rows. Run them against a local dev database.

function Send-Sentinel {
    param(
        [Parameter(Mandatory = $true)][string]$Route,
        [Parameter(Mandatory = $true)][string]$Json,
        [Parameter(Mandatory = $true)][string]$Title
    )
    $base = if ($env:SENTINEL_API_URL) { $env:SENTINEL_API_URL.TrimEnd("/") } else { "http://127.0.0.1:8000" }
    Write-Host ""
    Write-Host "---- $Title ----"
    $file = Join-Path ([System.IO.Path]::GetTempPath()) ("sentinel-sim-" + [guid]::NewGuid().ToString() + ".json")
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($file, $Json, $utf8)
    & curl.exe -sS -w "`nHTTP %{http_code}`n" -X POST "$base$Route" -H "Content-Type: application/json" --data-binary "@$file"
    Remove-Item $file -ErrorAction SilentlyContinue
    Write-Host ""
}
