param([string]$Sdk=$env:ANDROID_HOME,[switch]$Public,[string]$Keystore,[string]$Alias='stardewthor')
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
if(!$Sdk){throw 'Set ANDROID_HOME or pass -Sdk (Android platform/build-tools 35 required).'}
$version=(Get-Content -LiteralPath "$project/package.json" -Raw | ConvertFrom-Json).version
$bt=Join-Path $Sdk 'build-tools/35.0.0'
$androidJar=Join-Path $Sdk 'platforms/android-35/android.jar'
New-Item -ItemType Directory -Force "$project/.deps","$project/artifacts" | Out-Null
$localJar=Join-Path $project '.deps/android-35.jar'
if(!(Test-Path $localJar) -or (Get-FileHash $localJar).Hash -ne (Get-FileHash $androidJar).Hash){Copy-Item -LiteralPath $androidJar -Destination $localJar -Force}
$androidJar=$localJar
$build=Join-Path $project ('android/build/run-'+[guid]::NewGuid())
# Each build works in its own run-* folder and removes it afterwards, failed or not (they used to pile up:
# 52 folders, 730 MB). The development keystore beside them in android/build is kept.
try{
New-Item -ItemType Directory -Force "$build/classes","$build/dex","$build/payload/assets" | Out-Null
function Check {if($LASTEXITCODE -ne 0){throw "Build failed: $LASTEXITCODE"}}
& javac -encoding UTF-8 -source 8 -target 8 -classpath $androidJar -d "$build/classes" (Get-ChildItem "$project/android/src" -Recurse -Filter '*.java' | ForEach-Object FullName)
Check
& jar cf "$build/classes.jar" -C "$build/classes" .
Check
& "$bt/d8.bat" --lib $androidJar --min-api 29 --output "$build/dex" "$build/classes.jar"
Check
$manifest="$project/android/AndroidManifest.xml"
if($Public){
 if(!$Keystore -or !$env:THOR_STORE_PASSWORD -or !$env:THOR_KEY_PASSWORD){throw 'Public builds require -Keystore and THOR_STORE_PASSWORD/THOR_KEY_PASSWORD; no automatic development signer.'}
}else{
 # Development builds are a separate app (own ID and launcher name) so they never replace or look like the public one.
 $xml=(Get-Content $manifest -Raw).Replace('package="io.github.chankamman_dev.stardewds"','package="io.github.chankamman_dev.stardewds.dev"').Replace('android:name=".MainActivity"','android:name="io.github.chankamman_dev.stardewds.MainActivity"').Replace('android:name=".WikiReaderActivity"','android:name="io.github.chankamman_dev.stardewds.WikiReaderActivity"').Replace('android:label="StardewDS"','android:label="StardewDS Dev"')
 $manifest="$build/AndroidManifest.xml";[IO.File]::WriteAllText($manifest,$xml)
}
# Launcher icon (tools/build-icon.cjs output) and its colour.
& "$bt/aapt2.exe" compile --dir "$project/android/res" -o "$build/res.zip"
Check
& "$bt/aapt2.exe" link -I $androidJar --manifest $manifest -o "$build/unsigned.apk" "$build/res.zip"
Check
& jar uf "$build/unsigned.apk" -C "$build/dex" classes.dex
Check
$assetRoot=[IO.Path]::GetFullPath((Join-Path $project 'android/assets'))
foreach($file in Get-ChildItem $assetRoot -Recurse -File){
 $relative=$file.FullName.Substring($assetRoot.TrimEnd('\','/').Length+1).Replace('\','/')
 if($Public -and ($relative -eq 'offline.json' -or $relative.StartsWith('audio/') -or ($relative.StartsWith('art/') -and !$relative.EndsWith('.svg')))){continue}
 $destination=Join-Path "$build/payload/assets" $relative
 New-Item -ItemType Directory -Force (Split-Path $destination) | Out-Null
 Copy-Item -LiteralPath $file.FullName -Destination $destination
}
& jar uf "$build/unsigned.apk" -C "$build/payload" assets
Check
& "$bt/zipalign.exe" -f 4 "$build/unsigned.apk" "$build/aligned.apk"
Check
if(!$Keystore){$Keystore="$project/android/build/stardew-local.keystore";if(!(Test-Path $Keystore)){& keytool -genkeypair -keystore $Keystore -storepass android -keypass android -alias $Alias -dname 'CN=Stardew Thor Local Development' -keyalg RSA -keysize 2048 -validity 3650;Check}}
$apk=if($Public){"$project/artifacts/StardewDS-$version.apk"}else{"$project/artifacts/StardewDS-$version-local.apk"}
if($Public){& "$bt/apksigner.bat" sign --ks $Keystore --ks-key-alias $Alias --ks-pass env:THOR_STORE_PASSWORD --key-pass env:THOR_KEY_PASSWORD --out $apk "$build/aligned.apk"}else{& "$bt/apksigner.bat" sign --ks $Keystore --ks-key-alias $Alias --ks-pass pass:android --key-pass pass:android --out $apk "$build/aligned.apk"}
Check
& "$bt/apksigner.bat" verify --print-certs $apk
Check
Get-FileHash $apk
}finally{Remove-Item -LiteralPath $build -Recurse -Force -ErrorAction SilentlyContinue}
