; SafeShot NSIS installer script
; Handles Windows PrtScn registry override on install/uninstall
; Requirements: 2.9, 2.10, 2.11

!macro customInstall
  ; Read current value and back it up (Requirement 2.11)
  ReadRegDWORD $0 HKCU "Control Panel\Keyboard" "PrintScreenKeyForSnippingEnabled"
  ${If} $0 == ""
    StrCpy $0 "1"
  ${EndIf}

  ; Write backup to registry for uninstaller
  WriteRegStr HKCU "Software\SafeShot" "PrtScnBackup" "$0"

  ; Disable Windows Snipping Tool PrtScn binding (Requirement 2.9)
  WriteRegDWORD HKCU "Control Panel\Keyboard" "PrintScreenKeyForSnippingEnabled" 0
!macroend

!macro customUnInstall
  ; Restore original PrtScn registry value (Requirement 2.10)
  ReadRegStr $0 HKCU "Software\SafeShot" "PrtScnBackup"
  ${If} $0 == ""
    StrCpy $0 "1"
  ${EndIf}

  WriteRegDWORD HKCU "Control Panel\Keyboard" "PrintScreenKeyForSnippingEnabled" $0

  ; Clean up SafeShot registry key
  DeleteRegKey HKCU "Software\SafeShot"
!macroend
