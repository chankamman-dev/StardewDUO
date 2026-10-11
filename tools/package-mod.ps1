$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
$version=(Get-Content -LiteralPath "$project\mod\manifest.json" -Raw | ConvertFrom-Json).Version
& dotnet build "$project\mod\StardewThor.ReadOnly.csproj" -c Release --nologo
if($LASTEXITCODE -ne 0){throw 'Mod build failed'}
$stage=Join-Path $project "artifacts\mod-$version\StardewThor.ReadOnly"
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item -LiteralPath "$project\mod\manifest.json","$project\mod\bin\Release\net6.0\StardewThor.ReadOnly.dll","$project\mod\bin\Release\net6.0\StardewThor.Bridge.dll" -Destination $stage -Force
$names=@(Get-ChildItem -LiteralPath $stage -File | ForEach-Object Name | Sort-Object)
if(($names -join ',') -ne 'manifest.json,StardewThor.Bridge.dll,StardewThor.ReadOnly.dll'){throw 'Unexpected file in release staging; review before packaging'}
Compress-Archive -LiteralPath $stage -DestinationPath "$project\artifacts\StardewDS-Mod-$version.zip" -Force
Get-FileHash "$project\artifacts\StardewDS-Mod-$version.zip"
