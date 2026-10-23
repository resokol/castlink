; Dedicated on-demand component only. Registration never starts the application.
!macro customInstall
  WriteRegStr HKCU "Software\Classes\castlink-share" "" "URL:CastLink Screen Share"
  WriteRegStr HKCU "Software\Classes\castlink-share" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\castlink-share\DefaultIcon" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
  WriteRegStr HKCU "Software\Classes\castlink-share\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro customUnInstall
  ; Preserve a later installation or another handler that replaced this command.
  Push $R0
  ReadRegStr $R0 HKCU "Software\Classes\castlink-share\shell\open\command" ""
  StrCmp $R0 '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"' 0 +2
  DeleteRegKey HKCU "Software\Classes\castlink-share"
  Pop $R0
!macroend
