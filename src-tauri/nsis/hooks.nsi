!macro NSIS_HOOK_PREINSTALL
  ; Save the original PrtScn Snipping Tool state before we override it.
  ; Only save if we haven't already (avoid overwriting on upgrades).
  ReadRegDWORD $0 HKCU "Software\SafeShot" "OrigPrtScnState"
  ${If} ${Errors}
    ; First install: read the current Windows setting
    ClearErrors
    ReadRegDWORD $0 HKCU "Control Panel\Keyboard" "PrintScreenKeyForSnippingEnabled"
    ${If} ${Errors}
      ; Key doesn't exist, Windows default is enabled (1)
      WriteRegDWORD HKCU "Software\SafeShot" "OrigPrtScnState" 1
    ${Else}
      WriteRegDWORD HKCU "Software\SafeShot" "OrigPrtScnState" $0
    ${EndIf}
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Only remove user data if the "Delete app data" checkbox was checked
  ${If} $DeleteAppDataCheckboxState == 1
    RMDir /r "$LOCALAPPDATA\SafeShot"
  ${EndIf}

  ; Remove autostart registry entry
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "SafeShot"

  ; Restore the original PrtScn Snipping Tool setting
  ReadRegDWORD $0 HKCU "Software\SafeShot" "OrigPrtScnState"
  ${IfNot} ${Errors}
    WriteRegDWORD HKCU "Control Panel\Keyboard" "PrintScreenKeyForSnippingEnabled" $0
  ${EndIf}

  ; Clean up our own registry key
  DeleteRegKey HKCU "Software\SafeShot"
!macroend
