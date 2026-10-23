; Combined preview client: explicit per-user component URI registration.
!include "${BUILD_RESOURCES_DIR}\installer.nsh"
!macro customInstall
  WriteRegStr HKCU "Software\Classes\castlink-remote" "" "URL:CastLink remote PC component"
  WriteRegStr HKCU "Software\Classes\castlink-remote" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\castlink-remote\shell\open\command" "" '"$INSTDIR\CastLink Client Preview.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\castlink-presenter" "" "URL:CastLink presentation component"
  WriteRegStr HKCU "Software\Classes\castlink-presenter" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\castlink-presenter\DefaultIcon" "" '"$INSTDIR\CastLink Client Preview.exe",0'
  WriteRegStr HKCU "Software\Classes\castlink-presenter\shell\open\command" "" '"$INSTDIR\CastLink Client Preview.exe" "%1"'
!macroend
!macro customUnInstall
  ReadRegStr $0 HKCU "Software\Classes\castlink-remote\shell\open\command" ""
  ${If} $0 == '"$INSTDIR\CastLink Client Preview.exe" "%1"'
    DeleteRegKey HKCU "Software\Classes\castlink-remote"
  ${EndIf}
  ReadRegStr $0 HKCU "Software\Classes\castlink-presenter\shell\open\command" ""
  ${If} $0 == '"$INSTDIR\CastLink Client Preview.exe" "%1"'
    DeleteRegKey HKCU "Software\Classes\castlink-presenter"
  ${EndIf}
!macroend
