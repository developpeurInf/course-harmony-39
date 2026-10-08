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
echo   2/3  Commit sur la branche claude/quiz-fixes-and-redesign
echo ============================================
git checkout -b claude/quiz-fixes-and-redesign 2>nul || git checkout claude/quiz-fixes-and-redesign
git add -A -- . ":!build-et-push.bat"
git commit -m "fix(quiz): parametres appliques cote eleve, logique corrigee, nouveau design + espacement PDF diagnostic" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01C3ebCLdMbYYMaD6paPYke9"

echo.
echo ============================================
echo   3/3  git push
echo ============================================
git push -u origin claude/quiz-fixes-and-redesign
if errorlevel 1 (
  echo.
  echo *** LE PUSH A ECHOUE - verifie ta connexion GitHub. ***
  pause
  exit /b 1
)

echo.
echo Termine ! Branche poussee : claude/quiz-fixes-and-redesign
pause
