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
echo   2/3  Commit sur la branche claude/nextjs-redesign
echo ============================================
git checkout -b claude/nextjs-redesign 2>nul || git checkout claude/nextjs-redesign
git add -A -- . ":!build-et-push.bat"
git commit -m "feat: migration vers Next.js et nouveau design" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01AVw5TfPY7pA5AMRgBNA6sQ"

echo.
echo ============================================
echo   3/3  git push
echo ============================================
git push -u origin claude/nextjs-redesign
if errorlevel 1 (
  echo.
  echo *** LE PUSH A ECHOUE - verifie ta connexion GitHub. ***
  pause
  exit /b 1
)

echo.
echo Termine ! Branche poussee : claude/nextjs-redesign
pause
