@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   1/3  npm run build
echo ============================================
call npm run build
if errorlevel 1 (
  echo.
  echo *** LE BUILD A ECHOUE - rien n'a ete pousse. Copie l'erreur ci-dessus a Claude. ***
  pause
  exit /b 1
)

echo.
echo ============================================
echo   2/3  Commit sur la branche claude/compat-ipad-ios12-android
echo ============================================
git checkout -b claude/compat-ipad-ios12-android 2>nul || git checkout claude/compat-ipad-ios12-android
git add -A -- . ":!build-et-push.bat" ":!build-et-push-compat.bat"
git commit -m "fix(compat): iPad iOS 12.5 (Safari 12) et Android - mode sombre, arabe RTL, espacements, menus tactiles, crash tableau de bord, telechargements" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01RoyfmrZyKuYRr3kKjTxUu2"

echo.
echo ============================================
echo   3/3  git push
echo ============================================
git push -u origin claude/compat-ipad-ios12-android
if errorlevel 1 (
  echo.
  echo *** LE PUSH A ECHOUE - verifie ta connexion GitHub. ***
  pause
  exit /b 1
)

echo.
echo Termine ! Branche poussee : claude/compat-ipad-ios12-android
pause
