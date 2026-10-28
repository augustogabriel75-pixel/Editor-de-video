; Instalador do MotionCut para Windows (NSIS).
; Gerado por scripts/build-win.sh: makensis -DVERSION=x.y.z -DAPPDIR=... -DOUTFILE=... desktop/installer.nsi
Unicode true
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!include "MUI2.nsh"

!define APPNAME "MotionCut"
!define EXENAME "MotionCut.exe"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\MotionCut"

Name "${APPNAME} ${VERSION}"
OutFile "${OUTFILE}"
; instalação por usuário: não pede senha de administrador
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\${APPNAME}"
InstallDirRegKey HKCU "Software\${APPNAME}" "InstallDir"
BrandingText "${APPNAME} ${VERSION}"

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "FileDescription" "Instalador do ${APPNAME}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "CompanyName" "${APPNAME}"
VIAddVersionKey "LegalCopyright" "${APPNAME}"

!define MUI_ICON "${APPDIR}\resources\app\icon.ico"
!define MUI_UNICON "${APPDIR}\resources\app\icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Instalar o ${APPNAME} ${VERSION}"
!define MUI_WELCOMEPAGE_TEXT "Editor de vídeo com IA Motion para o PC.$\r$\n$\r$\nInclui o FFmpeg, que converte sozinho os vídeos do iPhone (.MOV em HEVC/H.265 e HDR) na importação.$\r$\n$\r$\nClique em Avançar para continuar."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXENAME}"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir o ${APPNAME} agora"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"

Section "MotionCut" SecMain
  SectionIn RO
  ; fecha uma versão aberta antes de atualizar os arquivos
  nsExec::Exec 'taskkill /IM "${EXENAME}" /F'
  Sleep 500
  SetOutPath "$INSTDIR"
  RMDir /r "$INSTDIR\resources\app"
  File /r "${APPDIR}\*.*"

  WriteUninstaller "$INSTDIR\Desinstalar.exe"
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0
  CreateShortCut "$SMPROGRAMS\${APPNAME}\Desinstalar ${APPNAME}.lnk" "$INSTDIR\Desinstalar.exe"
  CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0

  WriteRegStr HKCU "Software\${APPNAME}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "${APPNAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayIcon" "$INSTDIR\${EXENAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /IM "${EXENAME}" /F'
  Sleep 500
  Delete "$DESKTOP\${APPNAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APPNAME}"
  ; apaga só o que o instalador colocou (lista gerada no build) e a pasta, se ficar vazia
  !include "${APPDIR}\..\uninstall-files.nsh"
  Delete "$INSTDIR\Desinstalar.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "${UNINSTKEY}"
  DeleteRegKey HKCU "Software\${APPNAME}"
  ; os projetos salvos (em %APPDATA%\MotionCut) são mantidos
SectionEnd
