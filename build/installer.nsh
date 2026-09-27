; WriteMate AI — custom NSIS include (Phase E).
;
; electron-builder's own default install directory depends on the
; "perMachine" setting in package.json's "build.nsis" block:
;   - perMachine: true  -> %PROGRAMFILES64%\<productName> (needs an admin/
;     UAC elevation prompt every install/update, since Program Files is
;     protected for regular users)
;   - perMachine: false -> %LOCALAPPDATA%\Programs\<productName> (no admin
;     needed, but it's a hidden per-user folder most people never look in)
;
; Per Akash's explicit choice, WriteMate installs to a plain, easy-to-find
; folder at the root of the C: drive instead: C:\WriteMate AI. Keeping
; perMachine:false means no UAC prompt is needed on a normal Windows setup
; (regular users can create folders directly under C:\ by default).
;
; customInit is one of electron-builder's documented NSIS customization
; hooks (see their nsis-customization docs) — it runs during the
; installer's .onInit, before the "Choose Install Location" page is shown,
; so overriding $INSTDIR here changes the *default* path the installer
; proposes. allowToChangeInstallationDirectory stays true in package.json,
; so anyone installing can still pick a different folder on that page if
; they want to.
!macro customInit
  StrCpy $INSTDIR "C:\WriteMate AI"
!macroend
