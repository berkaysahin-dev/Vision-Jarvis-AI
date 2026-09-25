Set WshShell = CreateObject("WScript.Shell")
' Set working directory to the script's folder
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
' Run electron in production mode, 0 means hide window
WshShell.Run "cmd /c set NODE_ENV=production && .\node_modules\.bin\electron.cmd .", 0, False
