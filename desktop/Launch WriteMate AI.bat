@echo off
REM WriteMate AI desktop launcher.
REM Double-click this (or the Desktop shortcut pointing at it) to start the
REM app. Console window minimizes itself; close the WriteMate AI window (or
REM the console) to stop it.

cd /d "C:\Users\ASUS\Downloads\Writemate Ai-12092026\writemate-ai"
start "WriteMate AI" /min cmd /c "npm run electron"
