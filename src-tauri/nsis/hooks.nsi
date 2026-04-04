!macro NSIS_HOOK_POSTUNINSTALL
  ; Remove SafeShot user data folder (config, logs)
  RMDir /r "$LOCALAPPDATA\SafeShot"
!macroend
