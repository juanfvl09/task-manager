# Exporta a certs\ las CA raíz que Windows tiene instaladas y que no son públicas.
# En redes que inspeccionan HTTPS (proxy o firewall corporativo) ahí está la CA que
# los contenedores necesitan para confiar en esas conexiones.
# Uso, desde la carpeta jenkins:  powershell -ExecutionPolicy Bypass -File .\exportar-ca.ps1
$ErrorActionPreference = 'Stop'
$certs = Join-Path $PSScriptRoot 'certs'
New-Item -ItemType Directory -Force $certs | Out-Null

# Huellas SHA1 de las CA públicas que ya trae Debian (la base de la imagen de Jenkins)
$py = 'import ssl,hashlib,re; t=open(''/etc/ssl/certs/ca-certificates.crt'').read(); [print(hashlib.sha1(ssl.PEM_cert_to_DER_cert(p)).hexdigest().upper()) for p in re.findall(''-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----'', t, re.S)]'
$publicas = docker run --rm python:3.12-slim python -c $py
if ($LASTEXITCODE -ne 0 -or -not $publicas) { throw 'No se pudo leer la lista de CA públicas. ¿Docker Desktop está abierto?' }
$publicas = @{} + ($publicas | ForEach-Object -Begin { $h = @{} } -Process { $h[$_.Trim()] = $true } -End { $h })

# Emisores públicos o de firma de código que Windows trae y Debian no: no hacen falta
$publicosConocidos = 'Microsoft|VeriSign|thawte|GeoTrust|Symantec|DigiCert|GlobalSign|Sectigo|COMODO|GoDaddy|Starfield|Entrust|USERTrust|Baltimore|QuoVadis|IdenTrust|ISRG|Amazon|Google|Certum|SSL.com|Actalis|Buypass|SwissSign|HARICA|Telia|TeleSec|D-TRUST|Code Signing|Timestamp'

$candidatas = Get-ChildItem 'Cert:\LocalMachine\Root', 'Cert:\CurrentUser\Root' |
    Where-Object { $_.NotAfter -gt (Get-Date) -and $_.Subject -notmatch $publicosConocidos -and -not $publicas.ContainsKey($_.Thumbprint) } |
    Sort-Object Thumbprint -Unique

if (-not $candidatas) { Write-Host 'Windows no tiene CA raíz adicionales: Jenkins se construye sin certificados extra.'; exit 0 }
foreach ($x in $candidatas) {
    $cn = $x.GetNameInfo('SimpleName', $false)
    $nombre = ($cn -replace '[^A-Za-z0-9]+', '-').Trim('-').ToLower() + '.crt'
    $b64 = [Convert]::ToBase64String($x.RawData, 'InsertLineBreaks').Replace("`r`n", "`n")
    [IO.File]::WriteAllText((Join-Path $certs $nombre), "-----BEGIN CERTIFICATE-----`n$b64`n-----END CERTIFICATE-----`n")
    Write-Host "Exportada: certs\$nombre  ($($x.Subject))"
}
Write-Host 'Listo. Ahora: docker compose up -d --build'
