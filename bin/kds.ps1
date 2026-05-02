#Requires -Version 5.1
<#
.SYNOPSIS
    kds -- LineOps KDS CLI for Windows (PowerShell)

.DESCRIPTION
    Manages the KDS backend and provides quick order/station/device commands.

    Usage:  .\bin\kds.ps1 <command> [args]

    Set KDS_HOST to override the API URL (default: http://localhost:80)
    Set KDS_DIR  to override the project directory (default: repo root)

.EXAMPLE
    .\bin\kds.ps1 status
    .\bin\kds.ps1 orders
    .\bin\kds.ps1 orders bump 101
    .\bin\kds.ps1 logs api
    .\bin\kds.ps1 help
#>
param(
    [Parameter(Position=0)] [string] $Command  = "help",
    [Parameter(Position=1)] [string] $Sub      = "",
    [Parameter(Position=2)] [string] $Arg1     = "",
    [Parameter(Position=3)] [string] $Arg2     = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "SilentlyContinue"

# ── Config ─────────────────────────────────────────────────────────────────────
$KDS_HOST = if ($env:KDS_HOST) { $env:KDS_HOST } else { "http://localhost:80" }
$KDS_DIR  = if ($env:KDS_DIR)  { $env:KDS_DIR  } else { Split-Path $PSScriptRoot -Parent }

# ── Helpers ────────────────────────────────────────────────────────────────────
function Info  ($m) { Write-Host "  -> $m" -ForegroundColor Cyan }
function Ok    ($m) { Write-Host "  OK $m" -ForegroundColor Green }
function Warn  ($m) { Write-Host "  !! $m" -ForegroundColor Yellow }
function Die   ($m) { Write-Host "  ERR $m" -ForegroundColor Red; exit 1 }
function Hr        { Write-Host ("  " + "-" * 68) -ForegroundColor DarkGray }
function Pad   ([int]$w, [string]$s) { $s.PadRight($w).Substring(0, [Math]::Min($s.Length, $w)) + " " * [Math]::Max(0, $w - $s.Length) }

function Api {
    param(
        [string] $Method = "GET",
        [string] $Path   = "/api/health",
        [object] $Body   = $null
    )
    $url = "$KDS_HOST$Path"
    try {
        if ($Body) {
            $json = $Body | ConvertTo-Json -Depth 10
            return Invoke-RestMethod -Method $Method -Uri $url `
                -ContentType "application/json" -Body $json -TimeoutSec 10
        } else {
            return Invoke-RestMethod -Method $Method -Uri $url -TimeoutSec 10
        }
    } catch {
        $msg = $_.Exception.Message
        Die "API request failed: $Method $Path -- $msg"
    }
}

function RequireDocker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Die "Docker is required. Run install.ps1 first."
    }
    $null = docker compose version 2>&1
    if ($LASTEXITCODE -ne 0) { Die "Docker Compose v2 is required." }
}

function Dc {
    RequireDocker
    $composeFile = Join-Path $KDS_DIR "docker-compose.yml"
    $envFile     = Join-Path $KDS_DIR ".env"
    $extraArgs   = $args
    if (Test-Path $envFile) {
        docker compose -f $composeFile --env-file $envFile --project-name kds @extraArgs
    } else {
        docker compose -f $composeFile --project-name kds @extraArgs
    }
}

# ── Commands ───────────────────────────────────────────────────────────────────

function Cmd-Help {
    Write-Host ""
    Write-Host "  kds.ps1 -- LineOps KDS CLI" -ForegroundColor White
    Write-Host ""
    Write-Host "  System" -ForegroundColor White
    Write-Host "    kds.ps1 status              " -NoNewline -ForegroundColor Cyan; Write-Host "Show live system overview"
    Write-Host "    kds.ps1 start               " -NoNewline -ForegroundColor Cyan; Write-Host "Start all KDS services"
    Write-Host "    kds.ps1 stop                " -NoNewline -ForegroundColor Cyan; Write-Host "Stop all KDS services"
    Write-Host "    kds.ps1 restart             " -NoNewline -ForegroundColor Cyan; Write-Host "Restart all services"
    Write-Host "    kds.ps1 logs [svc]          " -NoNewline -ForegroundColor Cyan; Write-Host "Tail logs (api|web|db|proxy)"
    Write-Host "    kds.ps1 ip                  " -NoNewline -ForegroundColor Cyan; Write-Host "Show LAN IP for KDS devices"
    Write-Host "    kds.ps1 update              " -NoNewline -ForegroundColor Cyan; Write-Host "Rebuild images and restart"
    Write-Host ""
    Write-Host "  Orders" -ForegroundColor White
    Write-Host "    kds.ps1 orders              " -NoNewline -ForegroundColor Cyan; Write-Host "List active orders"
    Write-Host "    kds.ps1 orders bump <num>   " -NoNewline -ForegroundColor Cyan; Write-Host "Bump order by order number"
    Write-Host "    kds.ps1 orders recall <num> " -NoNewline -ForegroundColor Cyan; Write-Host "Recall a bumped order"
    Write-Host "    kds.ps1 orders add          " -NoNewline -ForegroundColor Cyan; Write-Host "Inject a test order"
    Write-Host ""
    Write-Host "  Stations / Devices" -ForegroundColor White
    Write-Host "    kds.ps1 stations            " -NoNewline -ForegroundColor Cyan; Write-Host "List kitchen stations"
    Write-Host "    kds.ps1 devices             " -NoNewline -ForegroundColor Cyan; Write-Host "List registered KDS displays"
    Write-Host ""
    Write-Host "  Config Templates" -ForegroundColor White
    Write-Host "    kds.ps1 templates           " -NoNewline -ForegroundColor Cyan; Write-Host "List saved display configs"
    Write-Host "    kds.ps1 templates push [id] " -NoNewline -ForegroundColor Cyan; Write-Host "Broadcast config to all displays"
    Write-Host "    kds.ps1 templates export <id>" -NoNewline -ForegroundColor Cyan; Write-Host " Print template JSON"
    Write-Host "    kds.ps1 templates delete <id>" -NoNewline -ForegroundColor Cyan; Write-Host " Delete a saved template"
    Write-Host "    kds.ps1 templates import <f> " -NoNewline -ForegroundColor Cyan; Write-Host " Import JSON file as template"
    Write-Host ""
    Write-Host "  Integrations & API Access" -ForegroundColor White
    Write-Host "    kds.ps1 integrations        " -NoNewline -ForegroundColor Cyan; Write-Host "List POS integration status"
    Write-Host "    kds.ps1 integrations events " -NoNewline -ForegroundColor Cyan; Write-Host "Recent inbound webhook events"
    Write-Host "    kds.ps1 keys                " -NoNewline -ForegroundColor Cyan; Write-Host "List API keys"
    Write-Host "    kds.ps1 keys create <n> <s> " -NoNewline -ForegroundColor Cyan; Write-Host "Create API key (name, storeId)"
    Write-Host "    kds.ps1 keys revoke <id>    " -NoNewline -ForegroundColor Cyan; Write-Host "Revoke an API key"
    Write-Host "    kds.ps1 webhooks            " -NoNewline -ForegroundColor Cyan; Write-Host "List outbound webhooks"
    Write-Host "    kds.ps1 inject              " -NoNewline -ForegroundColor Cyan; Write-Host "Inject a test order via API"
    Write-Host ""
    Write-Host "  KDS_HOST=$KDS_HOST   KDS_DIR=$KDS_DIR" -ForegroundColor DarkGray
    Write-Host ""
}

function Cmd-Status {
    $health = $null
    try { $health = Api GET /api/health } catch { Warn "API unreachable at $KDS_HOST"; return }

    $orders  = try { Api GET "/api/orders?status=pending" }  catch { @{ orders = @() } }
    $devices = try { Api GET "/api/devices" }                 catch { @{ devices = @() } }
    $stations= try { Api GET "/api/stations" }                catch { @{ stations = @() } }

    $orderCount   = @($orders.orders).Count
    $pendingItems = @($orders.orders | ForEach-Object { $_.items } | Where-Object { $_.status -eq "pending" }).Count
    $deviceTotal  = @($devices.devices).Count
    $deviceOnline = @($devices.devices | Where-Object { $_.isOnline }).Count
    $stTotal      = @($stations.stations).Count
    $stActive     = @($stations.stations | Where-Object { $_.isActive }).Count
    $version      = if ($health.version) { $health.version } else { "1.0.0" }

    Write-Host ""
    Hr
    Write-Host "  KDS System Status" -NoNewline -ForegroundColor White
    Write-Host "                       " -NoNewline
    Write-Host "ONLINE" -ForegroundColor Green
    Hr
    Write-Host ("  " + (Pad 22 "Active Orders") + (Pad 8 $orderCount) + "  " + (Pad 22 "Devices Online") + "${deviceOnline}/${deviceTotal}")
    Write-Host ("  " + (Pad 22 "Items Pending")  + (Pad 8 $pendingItems) + "  " + (Pad 22 "Stations Active") + "${stActive}/${stTotal}")
    Write-Host ("  " + (Pad 22 "API Endpoint")   + (Pad 8 $KDS_HOST) + "  " + (Pad 22 "Version") + $version)
    Hr
    Write-Host ""
}

function Cmd-Ip {
    $lanIp = (
        Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.*" } |
        Sort-Object InterfaceMetric |
        Select-Object -First 1
    ).IPAddress
    if (-not $lanIp) { $lanIp = "localhost" }

    Write-Host ""
    Write-Host "  LAN IP:      " -NoNewline -ForegroundColor White; Write-Host $lanIp -ForegroundColor Green
    Write-Host "  KDS Display: " -NoNewline -ForegroundColor White; Write-Host "http://${lanIp}/" -ForegroundColor Cyan
    Write-Host "  Dashboard:   " -NoNewline -ForegroundColor White; Write-Host "http://${lanIp}/dashboard" -ForegroundColor Cyan
    Write-Host "  API:         " -NoNewline -ForegroundColor White; Write-Host "http://${lanIp}/api/health" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Point your KDS tablets and displays at the URL above." -ForegroundColor DarkGray
    Write-Host ""
}

function Cmd-Orders {
    switch ($Sub) {
        "bump" {
            if (-not $Arg1) { Die "Usage: kds.ps1 orders bump <order-number>" }
            $orders  = Api GET "/api/orders?status=pending"
            $orderId = @($orders.orders | Where-Object { $_.orderNumber -eq $Arg1 })[0].id
            if (-not $orderId) { Die "Order #$Arg1 not found or already completed" }
            Api PATCH "/api/orders/$orderId" @{ status = "completed" } | Out-Null
            Ok "Order #$Arg1 bumped -- marked complete"
        }
        "recall" {
            if (-not $Arg1) { Die "Usage: kds.ps1 orders recall <order-number>" }
            $orders  = Api GET "/api/orders?status=completed"
            $orderId = @($orders.orders | Where-Object { $_.orderNumber -eq $Arg1 })[0].id
            if (-not $orderId) { Die "Order #$Arg1 not found in completed orders" }
            Api PATCH "/api/orders/$orderId" @{ status = "in_progress" } | Out-Null
            Ok "Order #$Arg1 recalled -- back to in_progress"
        }
        "add" {
            Info "Adding a test order..."
            $stores  = Api GET /api/stores
            $storeId = @($stores.stores)[0].id
            if (-not $storeId) { Die "No stores found. Create a store first." }
            $num = Get-Random -Minimum 100 -Maximum 999
            $result = Api POST /api/orders @{
                storeId      = $storeId
                orderNumber  = "T$num"
                customerName = "Test Customer"
                priority     = "normal"
                items        = @(
                    @{ stationId = "grill"; name = "Test Burger"; quantity = 1; modifiers = @("No onions") }
                    @{ stationId = "fryer"; name = "Test Fries";  quantity = 1; modifiers = @() }
                )
            }
            Ok "Test order #$($result.order.orderNumber) created"
        }
        default {
            $orders = Api GET "/api/orders?status=pending"
            $list   = @($orders.orders)
            if ($list.Count -eq 0) { Info "No active orders -- kitchen is idle"; return }

            Write-Host ""
            Hr
            Write-Host ("  " + (Pad 5 "#") + (Pad 8 "NUM") + (Pad 20 "CUSTOMER") + (Pad 12 "ITEMS") + (Pad 10 "TIME") + "PRIORITY") -ForegroundColor White
            Hr
            foreach ($o in $list) {
                $elapsed = if ($o.elapsedSeconds) {
                    "$([Math]::Floor($o.elapsedSeconds/60)):$(($o.elapsedSeconds % 60).ToString('D2'))"
                } else { "--" }
                $prio = switch ($o.priority) {
                    "rush" { " RUSH!" }
                    "vip"  { " VIP" }
                    default { "" }
                }
                $prioColor = if ($o.priority -eq "rush") { "Red" } elseif ($o.priority -eq "vip") { "Yellow" } else { "White" }
                $items = "$(@($o.items).Count) items"
                Write-Host ("  " + (Pad 5 "*") + (Pad 8 $o.orderNumber) + (Pad 20 ($o.customerName ?? "--")) + (Pad 12 $items) + (Pad 10 $elapsed)) -NoNewline
                Write-Host $prio -ForegroundColor $prioColor
            }
            Hr
            Write-Host ""
        }
    }
}

function Cmd-Stations {
    $resp  = Api GET /api/stations
    $list  = @($resp.stations)
    Write-Host ""
    Hr
    Write-Host ("  " + (Pad 20 "STATION") + (Pad 14 "ID") + (Pad 12 "STATUS")) -ForegroundColor White
    Hr
    foreach ($s in $list) {
        $status = if ($s.isActive) { "● active" } else { "○ off" }
        $color  = if ($s.isActive) { "Green" } else { "DarkGray" }
        Write-Host ("  " + (Pad 20 $s.name) + (Pad 14 $s.id)) -NoNewline
        Write-Host $status -ForegroundColor $color
    }
    Hr
    Write-Host ""
}

function Cmd-Devices {
    $resp = Api GET /api/devices
    $list = @($resp.devices)
    if ($list.Count -eq 0) {
        Info "No devices registered yet."
        Write-Host "  -> Devices auto-register when a KDS display first connects." -ForegroundColor DarkGray
        Write-Host ""
        return
    }
    Write-Host ""
    Hr
    Write-Host ("  " + (Pad 20 "DEVICE") + (Pad 18 "IP") + (Pad 12 "STATUS") + (Pad 22 "TEMPLATE") + "LAST SEEN") -ForegroundColor White
    Hr
    foreach ($d in $list) {
        $status = if ($d.isOnline) { "● online" } else { "○ offline" }
        $color  = if ($d.isOnline) { "Green" } else { "DarkGray" }
        Write-Host ("  " + (Pad 20 ($d.name ?? "Unnamed")) + (Pad 18 ($d.ipAddress ?? "--"))) -NoNewline
        Write-Host (Pad 12 $status) -NoNewline -ForegroundColor $color
        Write-Host ((Pad 22 ($d.templateName ?? "--")) + ($d.lastSeenAt ?? "--")) -ForegroundColor DarkGray
    }
    Hr
    Write-Host ""
}

function Cmd-Integrations {
    switch ($Sub) {
        "events" {
            $resp  = Api GET "/api/integrations/events?limit=20"
            $evts  = @($resp.events)
            if ($evts.Count -eq 0) { Info "No integration events yet."; return }
            Write-Host ""
            Hr
            Write-Host ("  " + (Pad 12 "SOURCE") + (Pad 22 "TYPE") + (Pad 10 "STATUS") + "TIME") -ForegroundColor White
            Hr
            foreach ($e in $evts) {
                $state = if ($e.error) { "ERROR" } elseif ($e.processed) { "ok" } else { "ignored" }
                $color = if ($e.error) { "Red" } elseif ($e.processed) { "Green" } else { "DarkGray" }
                $time  = try { [datetime]$e.createdAt | Get-Date -Format "HH:mm:ss" } catch { "--" }
                Write-Host ("  " + (Pad 12 $e.source) + (Pad 22 $e.eventType)) -NoNewline
                Write-Host (Pad 10 $state) -NoNewline -ForegroundColor $color
                Write-Host $time -ForegroundColor DarkGray
            }
            Hr
            Write-Host ""
        }
        default {
            $resp = Api GET /api/integrations
            $list = @($resp.integrations)
            Write-Host ""
            Hr
            Write-Host ("  " + (Pad 24 "INTEGRATION") + (Pad 12 "AUTH") + "WEBHOOK / ENDPOINT") -ForegroundColor White
            Hr
            foreach ($i in $list) {
                $ep = $i.webhook ?? $i.endpoint ?? $i.rpcEndpoints.kitchenJobs ?? "--"
                Write-Host ("  " + (Pad 24 $i.name) + (Pad 12 $i.authType) + $ep)
            }
            Hr
            Write-Host ""
        }
    }
}

function Cmd-Keys {
    switch ($Sub) {
        "create" {
            if (-not $Arg1 -or -not $Arg2) { Die "Usage: kds.ps1 keys create <name> <storeId>" }
            $result = Api POST /api/keys @{
                storeId     = $Arg2
                name        = $Arg1
                permissions = @("orders:read", "orders:write")
            }
            Ok "API key created: $($result.key.name)"
            Write-Host ""
            Write-Host "  Raw key (save this -- shown once):" -ForegroundColor Yellow
            Write-Host "  $($result.key.rawKey)" -ForegroundColor Green
            Write-Host ""
        }
        "revoke" {
            if (-not $Arg1) { Die "Usage: kds.ps1 keys revoke <id>" }
            Api DELETE "/api/keys/$Arg1" | Out-Null
            Ok "Key $Arg1 revoked"
        }
        default {
            $resp = Api GET /api/keys
            $list = @($resp.keys)
            if ($list.Count -eq 0) { Info "No API keys yet."; return }
            Write-Host ""
            Hr
            Write-Host ("  " + (Pad 24 "NAME") + (Pad 20 "PREFIX") + (Pad 8 "ACTIVE") + "PERMISSIONS") -ForegroundColor White
            Hr
            foreach ($k in $list) {
                $active = if ($k.isActive) { "yes" } else { "no" }
                $color  = if ($k.isActive) { "Green" } else { "DarkGray" }
                $perms  = ($k.permissions -join ", ")
                Write-Host ("  " + (Pad 24 $k.name) + (Pad 20 $k.keyPrefix)) -NoNewline
                Write-Host (Pad 8 $active) -NoNewline -ForegroundColor $color
                Write-Host $perms -ForegroundColor DarkGray
            }
            Hr
            Write-Host ""
        }
    }
}

function Cmd-Webhooks {
    $resp = Api GET /api/webhooks
    $list = @($resp.webhooks)
    if ($list.Count -eq 0) { Info "No outbound webhooks registered."; return }
    Write-Host ""
    Hr
    Write-Host ("  " + (Pad 22 "NAME") + (Pad 8 "ACTIVE") + (Pad 40 "URL") + "EVENTS") -ForegroundColor White
    Hr
    foreach ($h in $list) {
        $active = if ($h.isActive) { "yes" } else { "no" }
        $color  = if ($h.isActive) { "Green" } else { "DarkGray" }
        $evts   = ($h.events -join ", ")
        $url    = if ($h.url.Length -gt 38) { $h.url.Substring(0,35) + "..." } else { $h.url }
        Write-Host ("  " + (Pad 22 $h.name)) -NoNewline
        Write-Host (Pad 8 $active) -NoNewline -ForegroundColor $color
        Write-Host ((Pad 40 $url) + $evts) -ForegroundColor DarkGray
    }
    Hr
    Write-Host ""
}

function Cmd-Templates {
    $resp = $null
    try { $resp = Api GET /api/kds/templates } catch { Warn "Templates API unavailable at $KDS_HOST"; return }
    $list = @($resp)

    switch ($Sub) {
        "push" {
            if ($Arg1) {
                $tpl = $list | Where-Object { $_.id -eq $Arg1 } | Select-Object -First 1
                if (-not $tpl) { Die "Template '$Arg1' not found" }
                $body = @{ name = $tpl.name; config = $tpl.config }
                Api POST /api/kds/templates/active $body | Out-Null
                Ok "Template '$($tpl.name)' broadcast to all displays"
                Write-Host "  Machine-local settings (zoom, bump bar, keys) are preserved on each display." -ForegroundColor DarkGray
            } else {
                $active = $null
                try { $active = Api GET /api/kds/templates/active } catch {}
                if (-not $active) { Die "No active template. Use 'kds.ps1 templates push <id>'." }
                $body = @{ name = $active.name; config = $active.config }
                Api POST /api/kds/templates/active $body | Out-Null
                Ok "Active template '$($active.name)' re-broadcast to all displays"
            }
        }
        "export" {
            if (-not $Arg1) { Die "Usage: kds.ps1 templates export <id>" }
            $tpl = $list | Where-Object { $_.id -eq $Arg1 } | Select-Object -First 1
            if (-not $tpl) { Die "Template '$Arg1' not found" }
            $tpl.config | ConvertTo-Json -Depth 20
        }
        "delete" {
            if (-not $Arg1) { Die "Usage: kds.ps1 templates delete <id>" }
            Api DELETE "/api/kds/templates/$Arg1" | Out-Null
            Ok "Template $Arg1 deleted"
        }
        "import" {
            if (-not $Arg1) { Die "Usage: kds.ps1 templates import <file.json> [name]" }
            if (-not (Test-Path $Arg1)) { Die "File not found: $Arg1" }
            $json   = Get-Content $Arg1 -Raw | ConvertFrom-Json
            $name   = if ($Arg2) { $Arg2 } else { [System.IO.Path]::GetFileNameWithoutExtension($Arg1) }
            Api POST /api/kds/templates @{ name = $name; config = $json } | Out-Null
            Ok "Template '$name' imported from $Arg1"
        }
        default {
            if ($list.Count -eq 0) {
                Info "No saved config templates."
                Write-Host "  Save a template from Settings -> Config Templates in the KDS display." -ForegroundColor DarkGray
                return
            }
            Write-Host ""
            Hr
            Write-Host ("  " + (Pad 38 "NAME") + (Pad 10 "ACTIVE") + "ID") -ForegroundColor White
            Hr
            foreach ($t in $list) {
                $active = if ($t.isActive) { "● yes" } else { "  —" }
                $color  = if ($t.isActive) { "Green" } else { "DarkGray" }
                Write-Host ("  " + (Pad 38 $t.name)) -NoNewline
                Write-Host (Pad 10 $active) -NoNewline -ForegroundColor $color
                Write-Host $t.id -ForegroundColor DarkGray
            }
            Hr
            Write-Host ""
            Write-Host "  kds.ps1 templates push <id>     broadcast to all displays" -ForegroundColor DarkGray
            Write-Host "  kds.ps1 templates export <id>   print config JSON" -ForegroundColor DarkGray
            Write-Host "  kds.ps1 templates delete <id>   remove a template" -ForegroundColor DarkGray
            Write-Host "  kds.ps1 templates import <file> import from JSON file" -ForegroundColor DarkGray
            Write-Host ""
        }
    }
}

function Cmd-Inject {
    Info "Injecting a test order..."
    try {
        $result = Invoke-RestMethod -Method Post -Uri "$KDS_HOST/api/test/inject-order" -TimeoutSec 10
        Ok "Test order injected: #$($result.order.orderNumber ?? '?')"
    } catch {
        Die "Inject failed: $($_.Exception.Message)"
    }
}

function Cmd-Logs {
    $svc = $Sub
    if ($svc) {
        Dc logs -f --tail=100 "kds-$svc"
    } else {
        Dc logs -f --tail=50
    }
}

function Cmd-Start   { Dc up -d --remove-orphans; Ok "KDS services started"; Cmd-Ip }
function Cmd-Stop    { Dc stop;    Ok "KDS services stopped" }
function Cmd-Restart { Dc restart; Ok "KDS services restarted" }
function Cmd-Update  {
    Info "Rebuilding and restarting..."
    Dc up -d --build --remove-orphans
    Ok "KDS updated and restarted"
    Cmd-Status
}

# ── Dispatch ───────────────────────────────────────────────────────────────────
switch ($Command.ToLower()) {
    "status"       { Cmd-Status }
    "ip"           { Cmd-Ip }
    "orders"       { Cmd-Orders }
    "stations"     { Cmd-Stations }
    "devices"      { Cmd-Devices }
    "templates"    { Cmd-Templates }
    "integrations" { Cmd-Integrations }
    "keys"         { Cmd-Keys }
    "webhooks"     { Cmd-Webhooks }
    "inject"       { Cmd-Inject }
    "logs"         { Cmd-Logs }
    "start"        { Cmd-Start }
    "stop"         { Cmd-Stop }
    "restart"      { Cmd-Restart }
    "update"       { Cmd-Update }
    { $_ -in "help","--help","-h" } { Cmd-Help }
    default        { Die "Unknown command: $Command  -- run 'kds.ps1 help'" }
}
