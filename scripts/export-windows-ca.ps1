<#
.SYNOPSIS
  Exporta o trust store do Windows pra `.windows-ca-bundle.pem` na raiz do repo.

.DESCRIPTION
  Em redes com antivírus/proxy fazendo SSL inspection (Kaspersky, Bitdefender,
  ESET, Trend Micro, Zscaler etc.), o cert raiz do interceptador fica instalado
  no Cert:\LocalMachine\Root do Windows — MAS Node.js, Prisma Rust engine e
  Deno têm trust stores próprios que não enxergam ele. Resultado: erros tipo
  `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, `Can't reach database server`, ou
  `invalid peer certificate: UnknownIssuer`.

  Esse script extrai todos os root CAs do Windows pra um arquivo PEM que pode
  ser apontado via NODE_EXTRA_CA_CERTS. Roda em ~2 segundos, idempotente.

.NOTES
  Workflow esperado:
    1. .\scripts\export-windows-ca.ps1
    2. setx NODE_EXTRA_CA_CERTS "$(Resolve-Path .\.windows-ca-bundle.pem)"
    3. Reabre o terminal (setx só vale em sessões NOVAS)
    4. `pnpm dev` confiará nos certs do antivírus

  Pra Prisma + Supabase pooler em dev: adicione `&sslmode=no-verify` nas URLs
  do `.env.local` (apenas dev). Em produção (Vercel) nada disso é necessário.

  Bundle NÃO deve ser commitado — está no .gitignore. Cada máquina exporta o
  próprio (os certs raiz do antivírus mudam por instalação).
#>

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path $PSScriptRoot -Parent
$bundlePath = Join-Path $repoRoot '.windows-ca-bundle.pem'

Write-Host "Exportando trust store do Windows..." -ForegroundColor Cyan

$certs = @()
$certs += Get-ChildItem -Path Cert:\LocalMachine\Root -ErrorAction SilentlyContinue
$certs += Get-ChildItem -Path Cert:\LocalMachine\CA   -ErrorAction SilentlyContinue
$certs += Get-ChildItem -Path Cert:\CurrentUser\Root  -ErrorAction SilentlyContinue
$certs += Get-ChildItem -Path Cert:\CurrentUser\CA    -ErrorAction SilentlyContinue

if ($certs.Count -eq 0) {
  Write-Error "Nenhum certificado encontrado no trust store. Aborting."
  exit 1
}

$lines = foreach ($cert in $certs) {
  "-----BEGIN CERTIFICATE-----"
  [Convert]::ToBase64String($cert.RawData, 'InsertLineBreaks')
  "-----END CERTIFICATE-----"
}

$lines | Out-File -FilePath $bundlePath -Encoding ascii

$size = (Get-Item $bundlePath).Length
Write-Host ""
Write-Host "Bundle gerado:  $bundlePath" -ForegroundColor Green
Write-Host "Certs:          $($certs.Count)"
Write-Host "Tamanho:        $([math]::Round($size / 1KB, 1)) KB"
Write-Host ""
Write-Host "Próximo passo:" -ForegroundColor Yellow
Write-Host "  setx NODE_EXTRA_CA_CERTS `"$bundlePath`""
Write-Host "  (depois reabra o terminal)"
