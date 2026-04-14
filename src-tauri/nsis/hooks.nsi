!macro NSIS_HOOK_POSTUNINSTALL
  ; Only remove user data if the "Delete app data" checkbox was checked
  ${If} $DeleteAppDataCheckboxState == 1
    RMDir /r "$LOCALAPPDATA\SafeShot"
  ${EndIf}
!macroend
