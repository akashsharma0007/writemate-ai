#Requires AutoHotkey v2.0
#SingleInstance Force

; ============================================================================
; WriteMate AI — Hotkey Bridge
;
; A global (system-wide) hotkey that lets WriteMate work in ANY Windows app —
; the Teams desktop client, Outlook, Notepad, a native (non-browser) app,
; anywhere you can select text — not just the browser.
;
; How it works: press the hotkey, it copies whatever text you have selected,
; sends it to your own local WriteMate server (the same one the web app and
; browser extension talk to — nothing ever leaves your machine except to
; whichever AI provider you've configured in Settings), shows you the result,
; and can paste it back over the original selection.
;
; Requirements:
;   - AutoHotkey v2.0 or later installed (free: https://www.autohotkey.com/)
;   - The WriteMate server running locally (npm run dev, or npm start) —
;     see ../../INSTALLATION.md if it isn't set up yet.
;
; See README.md in this folder for setup / usage / troubleshooting.
; ============================================================================

; ---------------------------- settings you can change ----------------------
SERVER_URL := "http://127.0.0.1:4173"
HOTKEY_STRING := "^!w"        ; Ctrl+Alt+W. ^ = Ctrl, ! = Alt, + = Shift, # = Win.
REQUEST_TIMEOUT_MS := 30000
; -----------------------------------------------------------------------------

A_IconTip := "WriteMate AI — Hotkey Bridge (" HOTKEY_STRING ")"

; Action id -> button label shown in the popup. Order matches the browser
; extension's quick-action panel so the experience feels the same everywhere.
ACTION_ORDER := ["fix_grammar", "improve", "professional", "concise", "friendly", "custom"]
ACTION_LABELS := Map(
    "fix_grammar", "Fix Grammar",
    "improve", "Rewrite",
    "professional", "Professional",
    "concise", "Concise",
    "friendly", "Friendly",
    "custom", "Custom…"
)

; ---------------------------- shared state ----------------------------------
targetHwnd := 0
capturedText := ""
actionButtons := []

; ---------------------------- GUI --------------------------------------------
mainGui := Gui("+AlwaysOnTop +ToolWindow", "WriteMate AI")
mainGui.OnEvent("Close", (*) => GuiHide())
mainGui.OnEvent("Escape", (*) => GuiHide())
mainGui.SetFont("s10", "Segoe UI")

mainGui.Add("Text",, "Selected text:")
txtOriginal := mainGui.Add("Edit", "w440 h70 ReadOnly VScroll")

mainGui.Add("Text",, "Context (optional) — what are you trying to say / who is this for?")
txtContext := mainGui.Add("Edit", "w440")

; Stacked full-width buttons (one per row) — the simplest layout AutoHotkey's
; default auto-flow places correctly with no manual x/y math to get wrong.
for actionId in ACTION_ORDER {
    btn := mainGui.Add("Button", "w440", ACTION_LABELS[actionId])
    btn.OnEvent("Click", RunAction.Bind(actionId))
    actionButtons.Push(btn)
}

statusText := mainGui.Add("Text", "xs w440 cGray", "")

mainGui.Add("Text", "xs", "Result:")
txtResult := mainGui.Add("Edit", "w440 h150 ReadOnly VScroll")

btnCopy := mainGui.Add("Button", "w140", "Copy")
btnReplace := mainGui.Add("Button", "x+10 w140", "Replace")
btnClose := mainGui.Add("Button", "x+10 w140", "Close")
btnCopy.OnEvent("Click", (*) => CopyResult())
btnReplace.OnEvent("Click", (*) => ReplaceInOriginal())
btnClose.OnEvent("Click", (*) => GuiHide())

; ---------------------------- hotkey -----------------------------------------
Hotkey(HOTKEY_STRING, OnHotkey)

OnHotkey(*) {
    global targetHwnd, capturedText, txtOriginal, txtContext, txtResult, statusText, mainGui, HOTKEY_STRING

    targetHwnd := WinExist("A")
    savedClip := ClipboardAll()
    A_Clipboard := ""
    Send("^c")
    gotClip := ClipWait(0.75)
    grabbed := A_Clipboard
    A_Clipboard := savedClip

    if (!gotClip || Trim(grabbed) = "") {
        TrayTip("No text was selected — select some text first, then press " HOTKEY_STRING ".")
        return
    }

    capturedText := grabbed
    txtOriginal.Text := capturedText
    txtContext.Text := ""
    txtResult.Text := ""
    statusText.Text := ""
    mainGui.Show()
}

GuiHide() {
    global mainGui
    mainGui.Hide()
}

; ---------------------------- running an action ------------------------------
RunAction(actionId, ctrl, *) {
    global capturedText, txtContext, txtResult, statusText, actionButtons, SERVER_URL, REQUEST_TIMEOUT_MS

    customInstruction := ""
    if (actionId = "custom") {
        ib := InputBox("What should WriteMate do with this text?", "Custom Instruction", "w420 h130")
        if (ib.Result = "Cancel")
            return
        customInstruction := Trim(ib.Value)
        if (customInstruction = "")
            return
    }

    contextText := Trim(txtContext.Text)
    statusText.Text := "Thinking…"
    SetButtonsEnabled(false)

    body := BuildRequestBody(capturedText, actionId, contextText, customInstruction)

    resp := ""
    errMsg := ""
    try {
        resp := HttpPostJson(SERVER_URL "/api/rewrite", body, REQUEST_TIMEOUT_MS)
    } catch as e {
        errMsg := e.Message
    }

    SetButtonsEnabled(true)

    if (errMsg != "") {
        statusText.Text := errMsg
        return
    }

    if (resp.status != 200) {
        msg := "Request failed (HTTP " resp.status ")."
        try {
            errObj := JsonParser.Parse(resp.body)
            if (IsObject(errObj) && errObj.Has("error"))
                msg := errObj["error"]
        }
        statusText.Text := msg
        return
    }

    try {
        data := JsonParser.Parse(resp.body)
    } catch as e {
        statusText.Text := "The server's response couldn't be read. Try again, or raise Max Output Tokens in Settings."
        return
    }

    resultText := data.Has("correctedText") ? data["correctedText"]
        : data.Has("improvedText") ? data["improvedText"]
        : ""

    if (resultText = "") {
        statusText.Text := "No result came back — try again."
        return
    }

    txtResult.Text := resultText
    statusText.Text := "Done."

    if (data.Has("warnings") && IsObject(data["warnings"]) && data["warnings"].Length > 0) {
        warnLines := ""
        for w in data["warnings"]
            warnLines .= "⚠ " w "`n"
        statusText.Text := Trim(warnLines, "`n")
    }
}

SetButtonsEnabled(enabled) {
    global actionButtons
    for btn in actionButtons
        btn.Enabled := enabled
}

; ---------------------------- copy / replace ---------------------------------
CopyResult() {
    global txtResult, statusText
    if (Trim(txtResult.Text) = "")
        return
    A_Clipboard := txtResult.Text
    statusText.Text := "Copied to clipboard."
}

ReplaceInOriginal() {
    global txtResult, targetHwnd, mainGui, statusText
    if (Trim(txtResult.Text) = "")
        return
    A_Clipboard := txtResult.Text
    mainGui.Hide()
    if (targetHwnd && WinExist("ahk_id " targetHwnd)) {
        WinActivate("ahk_id " targetHwnd)
        Sleep(150)
        Send("^v")
    } else {
        TrayTip("The original window couldn't be found — the result is on your clipboard, paste it manually (Ctrl+V).")
    }
}

; ---------------------------- HTTP -------------------------------------------
HttpPostJson(url, jsonBody, timeoutMs) {
    try {
        req := ComObject("WinHttp.WinHttpRequest.5.1")
    } catch {
        throw Error("This Windows install is missing WinHTTP — the hotkey bridge can't make requests. This would be very unusual on a normal Windows PC.")
    }
    req.Open("POST", url, false)
    req.SetRequestHeader("Content-Type", "application/json")
    req.SetTimeouts(5000, 5000, timeoutMs, timeoutMs)
    try {
        req.Send(jsonBody)
    } catch {
        throw Error("Couldn't reach the WriteMate server at " url ". Make sure it's running (npm run dev, in the writemate-ai folder) and try again.")
    }
    return { status: req.Status, body: req.ResponseText }
}

; ---------------------------- minimal JSON encode -----------------------------
JsonEscape(s) {
    s := StrReplace(s, "\", "\\")
    s := StrReplace(s, '"', '\"')
    s := StrReplace(s, "`r`n", "\n")
    s := StrReplace(s, "`n", "\n")
    s := StrReplace(s, "`r", "\n")
    s := StrReplace(s, "`t", "\t")
    return s
}

JsonStr(s) {
    return '"' JsonEscape(s) '"'
}

BuildRequestBody(text, actionId, contextText, customInstruction) {
    body := '{"text":' JsonStr(text) ',"action":' JsonStr(actionId)
    if (contextText != "")
        body .= ',"context":' JsonStr(contextText)
    if (customInstruction != "")
        body .= ',"customInstruction":' JsonStr(customInstruction)
    body .= "}"
    return body
}

; ---------------------------- minimal JSON decode -----------------------------
; A small recursive-descent parser — just enough to read the plain-JSON
; responses WriteMate's server sends back (objects/arrays/strings/numbers/
; booleans/null, with standard \" \\ \n \t \uXXXX escapes). Written from
; scratch so this script has zero third-party dependencies.
class JsonParser {
    static Parse(s) {
        pos := 1
        val := JsonParser.ParseValue(s, &pos)
        return val
    }

    static SkipWs(s, &pos) {
        len := StrLen(s)
        while (pos <= len && InStr(" `t`r`n", SubStr(s, pos, 1)))
            pos++
    }

    static ParseValue(s, &pos) {
        JsonParser.SkipWs(s, &pos)
        c := SubStr(s, pos, 1)
        if (c = '"')
            return JsonParser.ParseString(s, &pos)
        else if (c = "{")
            return JsonParser.ParseObject(s, &pos)
        else if (c = "[")
            return JsonParser.ParseArray(s, &pos)
        else if (SubStr(s, pos, 4) = "true") {
            pos += 4
            return true
        } else if (SubStr(s, pos, 5) = "false") {
            pos += 5
            return false
        } else if (SubStr(s, pos, 4) = "null") {
            pos += 4
            return ""
        } else
            return JsonParser.ParseNumber(s, &pos)
    }

    static ParseString(s, &pos) {
        pos++ ; skip opening quote
        out := ""
        len := StrLen(s)
        while (pos <= len) {
            c := SubStr(s, pos, 1)
            if (c = '"') {
                pos++
                return out
            } else if (c = "\") {
                nc := SubStr(s, pos + 1, 1)
                if (nc = '"')
                    out .= '"'
                else if (nc = "\")
                    out .= "\"
                else if (nc = "/")
                    out .= "/"
                else if (nc = "n")
                    out .= "`n"
                else if (nc = "t")
                    out .= "`t"
                else if (nc = "r")
                    out .= "`r"
                else if (nc = "b")
                    out .= Chr(8)
                else if (nc = "f")
                    out .= Chr(12)
                else if (nc = "u") {
                    hex := SubStr(s, pos + 2, 4)
                    out .= Chr("0x" hex)
                    pos += 4
                } else
                    out .= nc
                pos += 2
            } else {
                out .= c
                pos++
            }
        }
        return out ; unterminated string (shouldn't happen with well-formed JSON)
    }

    static ParseNumber(s, &pos) {
        start := pos
        len := StrLen(s)
        while (pos <= len && InStr("0123456789+-.eE", SubStr(s, pos, 1)))
            pos++
        return SubStr(s, start, pos - start) + 0
    }

    static ParseArray(s, &pos) {
        pos++ ; skip [
        arr := []
        JsonParser.SkipWs(s, &pos)
        if (SubStr(s, pos, 1) = "]") {
            pos++
            return arr
        }
        loop {
            val := JsonParser.ParseValue(s, &pos)
            arr.Push(val)
            JsonParser.SkipWs(s, &pos)
            c := SubStr(s, pos, 1)
            pos++
            if (c = ",")
                continue
            break
        }
        return arr
    }

    static ParseObject(s, &pos) {
        pos++ ; skip {
        obj := Map()
        JsonParser.SkipWs(s, &pos)
        if (SubStr(s, pos, 1) = "}") {
            pos++
            return obj
        }
        loop {
            JsonParser.SkipWs(s, &pos)
            key := JsonParser.ParseString(s, &pos)
            JsonParser.SkipWs(s, &pos)
            pos++ ; skip :
            val := JsonParser.ParseValue(s, &pos)
            obj[key] := val
            JsonParser.SkipWs(s, &pos)
            c := SubStr(s, pos, 1)
            pos++
            if (c = ",")
                continue
            break
        }
        return obj
    }
}
