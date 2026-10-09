param([int]$AppProcessId, [string]$FilePath, [switch]$ConfirmOnly)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class NativeFilePicker {
    public delegate bool EnumProc(IntPtr h, IntPtr param);
    [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumProc callback, IntPtr param);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder text, int max);
    [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, string l);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
}
"@
$root = [System.Windows.Automation.AutomationElement]::RootElement
$pidCondition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $AppProcessId)
$classCondition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ClassNameProperty, '#32770')
$condition = [System.Windows.Automation.AndCondition]::new($pidCondition, $classCondition)
$deadline = [DateTime]::UtcNow.AddSeconds(20)
$script:fileEditHandle = [IntPtr]::Zero
$script:submitHandle = [IntPtr]::Zero
$script:pickerControls = @{}
$callback = [NativeFilePicker+EnumProc] {
    param($windowHandle, $unused)
    $classText = [System.Text.StringBuilder]::new(256)
    [void][NativeFilePicker]::GetClassName($windowHandle,$classText,256)
    $controlId = [NativeFilePicker]::GetDlgCtrlID($windowHandle)
    if ($classText.ToString() -in @('Edit','ComboBox','ComboBoxEx32','Button')) { $script:pickerControls[$windowHandle.ToString()] = ($classText.ToString() + ':' + $controlId) }
    if ($classText.ToString() -eq 'Edit' -and $controlId -in @(1001,1148)) { $script:fileEditHandle=$windowHandle }
    if ($classText.ToString() -eq 'Button' -and $controlId -eq 1) { $script:submitHandle=$windowHandle }
    return $true
}
while ([DateTime]::UtcNow -lt $deadline) {
    $dialog = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $condition)
    if ($null -eq $dialog) {
        foreach ($appWindow in $root.FindAll([System.Windows.Automation.TreeScope]::Children, $pidCondition)) {
            $dialog = $appWindow.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $classCondition)
            if ($null -ne $dialog) { break }
        }
    }
    if ($null -ne $dialog) {
        [void][NativeFilePicker]::EnumChildWindows([IntPtr]$dialog.Current.NativeWindowHandle,$callback,[IntPtr]::Zero)
        if (($ConfirmOnly -or $script:fileEditHandle -ne [IntPtr]::Zero) -and $script:submitHandle -ne [IntPtr]::Zero) { break }
    }
    Start-Sleep -Milliseconds 200
}
if ((-not $ConfirmOnly -and $script:fileEditHandle -eq [IntPtr]::Zero) -or $script:submitHandle -eq [IntPtr]::Zero) { Write-Output ($script:pickerControls.Values -join ', '); throw 'The native file picker controls were not found.' }
if (-not $ConfirmOnly) { [void][NativeFilePicker]::SendMessage($script:fileEditHandle, 0x000C, [IntPtr]::Zero, $FilePath) }
[void][NativeFilePicker]::SendMessage($script:submitHandle, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Output 'Selected the test file in the app file dialog.'
