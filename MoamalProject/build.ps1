# Moamal Reading Adventure - one-click builder
# 1) generates natural voices  2) builds the Android APK
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ROOT
$TOOLS = Join-Path $ROOT 'tools'
New-Item -ItemType Directory -Force $TOOLS | Out-Null
$LOG = Join-Path $ROOT 'build_log.txt'
"" | Set-Content $LOG -Encoding UTF8
function Say($m) { $l = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $l -ForegroundColor Cyan; Add-Content $LOG $l -Encoding UTF8 }
function Fetch($url, $out) { if (-not (Test-Path $out)) { Say "download $url"; Invoke-WebRequest -Uri $url -OutFile "$out.part" -UseBasicParsing; Move-Item "$out.part" $out -Force } }
function Unzip($zip, $dst) { Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $dst) }
function Run($exe, [string[]]$a) { $ErrorActionPreference = 'Continue'; Say ("run " + (Split-Path $exe -Leaf) + " " + ($a -join ' ')); $o = & $exe @a 2>&1; $o | ForEach-Object { Add-Content $LOG ("    " + $_) -Encoding UTF8 }; if ($LASTEXITCODE -ne 0) { throw "failed: $exe (exit $LASTEXITCODE)" } }

try {
  Say "=== START ==="
  # ---------------- Python ----------------
  $py = $null
  foreach ($c in @('py', 'python')) {
    try { $v = & $c -c "import sys;print(sys.version_info[0]*100+sys.version_info[1])" 2>$null; if ($LASTEXITCODE -eq 0 -and [int]$v -ge 308) { $py = $c; break } } catch {}
  }
  if (-not $py) {
    $pyDir = Join-Path $TOOLS 'python'
    if (-not (Test-Path "$pyDir\python.exe")) {
      Fetch 'https://www.python.org/ftp/python/3.12.7/python-3.12.7-embed-amd64.zip' "$TOOLS\py.zip"
      Unzip "$TOOLS\py.zip" $pyDir
      $pth = Get-ChildItem $pyDir -Filter 'python*._pth' | Select-Object -First 1
      (Get-Content $pth.FullName) -replace '#import site', 'import site' | Set-Content $pth.FullName
      Fetch 'https://bootstrap.pypa.io/get-pip.py' "$TOOLS\get-pip.py"
      Run "$pyDir\python.exe" @("$TOOLS\get-pip.py", '--no-warn-script-location')
    }
    $py = "$pyDir\python.exe"
  }
  Say "python: $py"
  Run $py @('-m', 'pip', 'install', '--upgrade', '--quiet', 'edge-tts', '--no-warn-script-location')

  # ---------------- Voices ----------------
  Say "=== VOICES ==="
  $env:PYTHONIOENCODING = 'utf-8'
  Run $py @("$ROOT\gen_voices.py")

  # ---------------- Quran ----------------
  Say "=== QURAN (text + audio, first time takes a while) ==="
  Run $py @("$ROOT\fetch_quran.py")
  if (-not (Test-Path "$ROOT\www\quran\quran.js")) { throw "quran data missing" }

  # ---------------- JDK ----------------
  Say "=== JDK ==="
  $java = $null
  if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\javac.exe")) { $java = $env:JAVA_HOME }
  if (-not $java) {
    $as = "$env:ProgramFiles\Android\Android Studio\jbr"
    if (Test-Path "$as\bin\javac.exe") { $java = $as }
  }
  if (-not $java) {
    $jdkDir = Join-Path $TOOLS 'jdk'
    if (-not (Test-Path $jdkDir)) { Fetch 'https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.zip' "$TOOLS\jdk.zip"; Unzip "$TOOLS\jdk.zip" $jdkDir }
    $java = (Get-ChildItem $jdkDir -Directory | Select-Object -First 1).FullName
  }
  $env:JAVA_HOME = $java; $env:Path = "$java\bin;$env:Path"
  Say "java: $java"

  # ---------------- Android SDK ----------------
  Say "=== ANDROID SDK ==="
  $sdk = $null
  foreach ($c in @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, "$env:LOCALAPPDATA\Android\Sdk", (Join-Path $TOOLS 'sdk'))) {
    if ($c -and (Test-Path "$c\build-tools") -and (Test-Path "$c\platforms")) { $sdk = $c; break }
  }
  $needInstall = $true
  if ($sdk) {
    $bt = Get-ChildItem "$sdk\build-tools" -Directory | Where-Object { Test-Path "$($_.FullName)\aapt2.exe" } | Sort-Object { [version]($_.Name -replace '[^0-9.]', '') } | Select-Object -Last 1
    $pf = Get-ChildItem "$sdk\platforms" -Directory | Where-Object { Test-Path "$($_.FullName)\android.jar" } | Sort-Object { [int]($_.Name -replace '\D', '') } | Select-Object -Last 1
    if ($bt -and $pf -and [int]($pf.Name -replace '\D', '') -ge 30) { $needInstall = $false }
  }
  if ($needInstall) {
    $sdk = Join-Path $TOOLS 'sdk'
    $cl = "$sdk\cmdline-tools\latest"
    if (-not (Test-Path "$cl\bin\sdkmanager.bat")) {
      Fetch 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip' "$TOOLS\cmdline.zip"
      $tmp = Join-Path $TOOLS 'cl_tmp'; if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
      Unzip "$TOOLS\cmdline.zip" $tmp
      New-Item -ItemType Directory -Force "$sdk\cmdline-tools" | Out-Null
      Move-Item "$tmp\cmdline-tools" $cl
    }
    Say "accepting licenses + installing platform/build-tools (takes a few minutes)"
    $ErrorActionPreference = 'Continue'
    New-Item -ItemType Directory -Force "$sdk\licenses" | Out-Null
    Set-Content "$sdk\licenses\android-sdk-license" "`n24333f8a63b6825ea9c5514f83c2829b004d1fee`nd56f5187479451eabf01fb78af6dfcb131a6481e`n8933bad161af4178b1185d1a37fbf41ea5269c55" -Encoding ASCII
    Set-Content "$sdk\licenses\android-sdk-preview-license" "`n84831b9409646a918e30573bab4c9c91346d8abd" -Encoding ASCII
    Set-Content "$TOOLS\yes.txt" (("y`r`n") * 40) -Encoding ASCII
    cmd /c "`"$cl\bin\sdkmanager.bat`" --sdk_root=`"$sdk`" --licenses < `"$TOOLS\yes.txt`"" 2>&1 | Out-Null
    $o = cmd /c "`"$cl\bin\sdkmanager.bat`" --sdk_root=`"$sdk`" `"platforms;android-34`" `"build-tools;34.0.0`" < `"$TOOLS\yes.txt`"" 2>&1
    $o | Select-Object -Last 8 | ForEach-Object { Add-Content $LOG ("    " + $_) -Encoding UTF8 }
    if (-not (Test-Path "$sdk\build-tools\34.0.0\aapt2.exe")) { throw "Android build-tools did not install - check internet and run again" }
    $bt = Get-Item "$sdk\build-tools\34.0.0"; $pf = Get-Item "$sdk\platforms\android-34"
    $ErrorActionPreference = 'Stop'
  }
  $BT = $bt.FullName; $AJ = "$($pf.FullName)\android.jar"
  Say "sdk: $sdk  build-tools: $($bt.Name)  platform: $($pf.Name)"

  # ---------------- Build APK ----------------
  Say "=== BUILD APK ==="
  $B = Join-Path $ROOT 'build'
  if (Test-Path $B) { Remove-Item $B -Recurse -Force }
  New-Item -ItemType Directory -Force "$B\obj", "$B\dex", "$B\assets" | Out-Null
  Copy-Item "$ROOT\www" "$B\assets\www" -Recurse
  $src = Get-ChildItem "$ROOT\android\src" -Recurse -Filter *.java | ForEach-Object { $_.FullName }
  Run "$java\bin\javac.exe" (@('-nowarn', '-source', '8', '-target', '8', '-encoding', 'UTF-8', '-bootclasspath', $AJ, '-d', "$B\obj") + $src)
  $cls = Get-ChildItem "$B\obj" -Recurse -Filter *.class | ForEach-Object { $_.FullName }
  Run "$BT\d8.bat" (@('--release', '--min-api', '24', '--lib', $AJ, '--output', "$B\dex") + $cls)
  Run "$BT\aapt2.exe" @('compile', '--dir', "$ROOT\android\res", '-o', "$B\res.zip")
  Run "$BT\aapt2.exe" @('link', '-o', "$B\base.apk", '-I', $AJ, '--manifest', "$ROOT\android\AndroidManifest.xml", '--min-sdk-version', '24', '--target-sdk-version', '34', "$B\res.zip")
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $z = [System.IO.Compression.ZipFile]::Open("$B\base.apk", 'Update')
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z, "$B\dex\classes.dex", 'classes.dex') | Out-Null
  $abase = (Resolve-Path "$B\assets").Path
  $nA = 0
  Get-ChildItem $abase -Recurse -File | ForEach-Object {
    $rel = 'assets/' + ($_.FullName.Substring($abase.Length + 1) -replace '\\', '/')
    $lvl = if ($_.Extension -in '.mp3', '.woff2', '.jpg', '.png') { [System.IO.Compression.CompressionLevel]::NoCompression } else { [System.IO.Compression.CompressionLevel]::Optimal }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z, $_.FullName, $rel, $lvl) | Out-Null
    $nA++
  }
  Say "assets added: $nA"
  if (-not ($z.Entries | Where-Object { $_.FullName -eq 'assets/www/index.html' })) { throw 'assets/www/index.html missing in APK' }
  $z.Dispose()
  Run "$BT\zipalign.exe" @('-p', '-f', '4', "$B\base.apk", "$B\aligned.apk")
  $ks = Join-Path $ROOT 'moamal.keystore'
  if (-not (Test-Path $ks)) { Run "$java\bin\keytool.exe" @('-genkeypair', '-keystore', $ks, '-alias', 'moamal', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-storepass', 'moamal123', '-keypass', 'moamal123', '-dname', 'CN=Moamal Reading') }
  $APK = Join-Path $ROOT 'MoamalReading.apk'
  Run "$BT\apksigner.bat" @('sign', '--ks', $ks, '--ks-pass', 'pass:moamal123', '--key-pass', 'pass:moamal123', '--out', $APK, "$B\aligned.apk")
  $mb = [math]::Round((Get-Item $APK).Length / 1MB, 1)
  Say "=== DONE === APK: $APK ($mb MB)"
  Write-Host ""
  Write-Host "  تم! ملف التطبيق جاهز: MoamalReading.apk" -ForegroundColor Green
} catch {
  Say ("=== ERROR === " + $_.Exception.Message)
  Write-Host $_ -ForegroundColor Red
}
Write-Host "Press Enter to close..."; [void](Read-Host)
