; Visual layer only: electron-builder owns installation and launch semantics.
!include "LogicLib.nsh"
!define MUI_BGCOLOR "191C20"
!define MUI_TEXTCOLOR "EEF0F2"
; MUI2 disables themed checkbox painting so SetCtlColors also colors Run text.
!define MUI_FORCECLASSICCONTROLS
!define MUI_DIRECTORYPAGE_BGCOLOR "22262C"
!define MUI_DIRECTORYPAGE_TEXTCOLOR "EEF0F2"
!define MUI_INSTFILESPAGE_COLORS "EEF0F2 191C20"
!define MUI_INSTFILESPAGE_PROGRESSBAR "colored"
!define MUI_CUSTOMFUNCTION_GUIINIT CastLinkGUIInit
!ifdef BUILD_UNINSTALLER
  !define MUI_CUSTOMFUNCTION_UNGUIINIT un.CastLinkGUIInit
!endif
!define MUI_WELCOMEPAGE_TITLE "CastLink Client"
!define MUI_WELCOMEPAGE_TEXT "$(CastLinkWelcome)"
!define MUI_FINISHPAGE_TITLE "$(CastLinkFinishTitle)"
!define MUI_FINISHPAGE_TEXT "$(CastLinkFinish)"
BrandingText "CastLink Client"
InstallColors EEF0F2 191C20

LangString CastLinkWelcome 1049 "Установите приложение для участия в трансляциях.$\r$\n$\r$\nЯрлыки CastLink Client появятся на рабочем столе и в меню «Пуск».$\r$\n$\r$\nНажмите «Далее», чтобы выбрать папку."
LangString CastLinkWelcome 1033 "Install the app to join broadcasts.$\r$\n$\r$\nCastLink Client shortcuts will appear on your desktop and in the Start menu.$\r$\n$\r$\nChoose Next to select a folder."
LangString CastLinkWelcome 2052 "安装应用程序以参与直播。$\r$\n$\r$\nCastLink Client 快捷方式将显示在桌面和开始菜单中。$\r$\n$\r$\n点击“下一步”选择文件夹。"
LangString CastLinkFinishTitle 1049 "CastLink Client установлен"
LangString CastLinkFinishTitle 1033 "CastLink Client is ready"
LangString CastLinkFinishTitle 2052 "CastLink Client 已安装"
LangString CastLinkFinish 1049 "Откройте приложение и подключитесь к своему серверу или перейдите по приглашению.$\r$\n$\r$\nВ следующий раз используйте ярлык CastLink Client."
LangString CastLinkFinish 1033 "Open the app and connect to your server, or follow an invitation.$\r$\n$\r$\nNext time, use the CastLink Client shortcut."
LangString CastLinkFinish 2052 "打开应用程序并连接到您的服务器，或通过邀请链接加入。$\r$\n$\r$\n下次请使用 CastLink Client 快捷方式。"

; The stock finish page retains its localized Run checkbox and StartApp function.
!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW CastLinkPageShow
!macroend
!macro customPageAfterChangeDir
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW CastLinkPageShow
!macroend
!macro customUnWelcomePage
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW un.CastLinkPageShow
  !insertmacro MUI_UNPAGE_WELCOME
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW un.CastLinkPageShow
!macroend

!macro CastLinkThemeFunctions PREFIX
Function ${PREFIX}CastLinkGUIInit
  SetCtlColors $HWNDPARENT EEF0F2 191C20
  GetDlgItem $0 $HWNDPARENT 1256
  SetCtlColors $0 ADB4BD 191C20
  System::Call 'dwmapi::DwmSetWindowAttribute(p$HWNDPARENT,i20,*i1,i4)'
FunctionEnd
!macroend
!macro CastLinkPageFunction PREFIX
Function ${PREFIX}CastLinkPageShow
  FindWindow $0 "#32770" "" $HWNDPARENT
  SetCtlColors $0 EEF0F2 191C20
  GetDlgItem $1 $0 1006
  SetCtlColors $1 EEF0F2 191C20
  GetDlgItem $1 $0 1020
  System::Call 'UXTHEME::SetWindowTheme(p$1,w" ",w" ")'
  SetCtlColors $1 ADB4BD 191C20
  GetDlgItem $1 $0 1023
  SetCtlColors $1 ADB4BD 191C20
  GetDlgItem $1 $0 1024
  SetCtlColors $1 ADB4BD 191C20
  GetDlgItem $1 $0 1004
  SetCtlColors $1 EEF0F2 191C20
  ; electron-builder install-mode nsDialogs label/radio/description controls.
  GetDlgItem $1 $0 1200
  SetCtlColors $1 EEF0F2 191C20
  GetDlgItem $1 $0 1201
  System::Call 'UXTHEME::SetWindowTheme(p$1,w" ",w" ")'
  SetCtlColors $1 ADB4BD 191C20
  GetDlgItem $1 $0 1202
  System::Call 'UXTHEME::SetWindowTheme(p$1,w" ",w" ")'
  SetCtlColors $1 EEF0F2 191C20
  GetDlgItem $1 $0 1203
  SetCtlColors $1 ADB4BD 191C20
FunctionEnd
!macroend
; The builder inserts its install-mode page between welcome and directory.
; Each MUI SHOW callback is consumed once. Keep the native MUI directory
; declaration and its existing PRE/LEAVE behavior, attaching only our SHOW hook.
!include "MUI2.nsh"
!macroundef MUI_PAGE_DIRECTORY
!macro MUI_PAGE_DIRECTORY
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW CastLinkPageShow
  !insertmacro MUI_PAGE_INIT
  !insertmacro MUI_PAGEDECLARATION_DIRECTORY
!macroend

!insertmacro CastLinkThemeFunctions ""
!ifdef BUILD_UNINSTALLER
  !insertmacro CastLinkThemeFunctions "un."
  !insertmacro CastLinkPageFunction "un."
!else
  !insertmacro CastLinkPageFunction ""
!endif
