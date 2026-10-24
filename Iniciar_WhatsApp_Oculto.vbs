' =============================================================================
' Salgados VIP - Inicializador Oculto do WhatsApp Silencioso (Zero Janelas)
' Roda 100% invisível em segundo plano usando pythonw.exe
' =============================================================================
Option Explicit

Dim FSO, WshShell, ScriptDir, PythonWPath, PyScript, Command

Set FSO = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = ScriptDir

PythonWPath = "C:\Users\Laura Barbosa\AppData\Local\Programs\Python\Python313\pythonw.exe"
If Not FSO.FileExists(PythonWPath) Then
    PythonWPath = "pythonw.exe"
End If

PyScript = ScriptDir & "\Servico_WhatsApp_Silencioso.py"

If FSO.FileExists(PyScript) Then
    ' Estilo 0 = Janela Oculta (Zero Prompt / Zero Janelas), False = Retorna imediatamente
    Command = Chr(34) & PythonWPath & Chr(34) & " " & Chr(34) & PyScript & Chr(34)
    WshShell.Run Command, 0, False
End If

Set WshShell = Nothing
Set FSO = Nothing
