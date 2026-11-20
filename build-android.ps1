$ErrorActionPreference = "Stop"

Write-Host "=== COPY FILES ==="

Copy-Item ".\KYIV_bezpeka_final.html" ".\www\index.html" -Force
Copy-Item ".\dtek-ui.js" ".\www\dtek-ui.js" -Force
Copy-Item ".\manifest.json" ".\www\manifest.json" -Force

Write-Host "=== CAPACITOR SYNC ==="

& "C:\Program Files\nodejs\node.exe" ".\node_modules\@capacitor\cli\bin\capacitor" sync android

Write-Host "=== BUILD APK ==="

Set-Location ".\android"
.\gradlew.bat assembleDebug

Write-Host "=== INSTALL APK ==="

& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r ".\app\build\outputs\apk\debug\app-debug.apk"

Write-Host "=== DONE ==="