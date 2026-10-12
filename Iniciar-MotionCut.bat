@echo off
rem MotionCut - inicia o editor no navegador (Windows). Requer Node.js 20.19+ ou 22.12+ (https://nodejs.org)
cd /d "%~dp0"
if not exist package.json (
  echo Extraia o ZIP inteiro numa pasta antes de executar este arquivo.
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 goto :nonode
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=12)||(a===20&&b>=19)?0:1)"
if errorlevel 1 goto :oldnode
if not exist node_modules (
  echo Instalando dependencias pela primeira vez, aguarde...
  call npm install
  if errorlevel 1 goto :fail
)
echo Abrindo o MotionCut no navegador...
call npm run dev -- --open
goto :end

:nonode
echo Node.js nao encontrado. Instale a versao LTS em https://nodejs.org e execute este arquivo de novo.
start "" https://nodejs.org/
goto :end

:oldnode
echo Sua versao do Node.js e antiga. Instale a versao LTS em https://nodejs.org e execute de novo.
start "" https://nodejs.org/
goto :end

:fail
echo Falha ao instalar as dependencias.

:end
pause
