param(
    [string]$RepoRoot = "C:\Users\Mylaptop\Desktop\Projects\Geodata.ge",
    [string]$WorkDir = "C:\Users\Mylaptop\Desktop\Projects\Geodata.ge\work\mof-validation-20260627"
)

$ErrorActionPreference = "Stop"

$sourceDir = Join-Path $RepoRoot "docs\Raw Data\Expenditure\mof.ge\final-fact-files-2004-2025"
$officeDir = Join-Path $WorkDir "office-rerun"
New-Item -ItemType Directory -Path $officeDir -Force | Out-Null

function New-ExcelApplication {
    $lastError = $null
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            return New-Object -ComObject Excel.Application
        }
        catch {
            $lastError = $_
            Start-Sleep -Seconds 2
        }
    }
    throw $lastError
}

function Convert-XlsCopyToXlsx {
    param(
        [int]$Year
    )

    $source = Join-Path $sourceDir "$Year-fact.xls"
    $copy = Join-Path $officeDir "$Year-fact-source-copy.xls"
    $output = Join-Path $officeDir "$Year-xls-rerun.xlsx"
    Copy-Item -LiteralPath $source -Destination $copy -Force

    $excel = $null
    $workbook = $null
    try {
        $excel = New-ExcelApplication
        $excel.Visible = $false
        $excel.DisplayAlerts = $false
        $workbook = $excel.Workbooks.Open($copy, 0, $true)
        $workbook.SaveAs($output, 51)
    }
    finally {
        if ($workbook -ne $null) {
            $workbook.Close($false)
            [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook)
        }
        if ($excel -ne $null) {
            $excel.Quit()
            [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
        }
        [GC]::Collect()
        [GC]::WaitForPendingFinalizers()
    }
}

function Convert-WordCopyTablesToCsv {
    param(
        [int]$Year
    )

    $source = Join-Path $sourceDir "$Year-fact.doc"
    $copy = Join-Path $officeDir "$Year-fact-source-copy.doc"
    $csvPath = Join-Path $officeDir "$Year-word-tables-rerun.csv"
    Copy-Item -LiteralPath $source -Destination $copy -Force

    $word = $null
    $document = $null
    $records = New-Object System.Collections.Generic.List[object]
    $maxColumns = 0

    try {
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false
        $word.DisplayAlerts = 0
        $document = $word.Documents.Open($copy, $false, $true)

        for ($tableIndex = 1; $tableIndex -le $document.Tables.Count; $tableIndex++) {
            $table = $document.Tables.Item($tableIndex)
            $rows = @{}

            foreach ($cell in @($table.Range.Cells)) {
                $rowIndex = [int]$cell.RowIndex
                $columnIndex = [int]$cell.ColumnIndex
                if (-not $rows.ContainsKey($rowIndex)) {
                    $rows[$rowIndex] = @{}
                }

                $text = [string]$cell.Range.Text
                $text = $text.TrimEnd(@([char]13, [char]7))
                $text = $text.Replace([string][char]13, "`n")
                $rows[$rowIndex][$columnIndex] = $text

                if ($columnIndex -gt $maxColumns) {
                    $maxColumns = $columnIndex
                }
            }

            foreach ($rowKey in ($rows.Keys | Sort-Object {[int]$_})) {
                $records.Add([pscustomobject]@{
                    table_index = $tableIndex
                    row_index = [int]$rowKey
                    cells = $rows[$rowKey]
                })
            }
        }
    }
    finally {
        if ($document -ne $null) {
            $document.Close($false)
            [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($document)
        }
        if ($word -ne $null) {
            $word.Quit()
            [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
        }
        [GC]::Collect()
        [GC]::WaitForPendingFinalizers()
    }

    $exportRows = New-Object System.Collections.Generic.List[object]
    foreach ($record in $records) {
        $row = [ordered]@{
            source_table = $record.table_index
            row_index = $record.row_index
        }
        for ($columnIndex = 1; $columnIndex -le $maxColumns; $columnIndex++) {
            $value = $null
            if ($record.cells.ContainsKey($columnIndex)) {
                $value = [string]$record.cells[$columnIndex]
            }
            $row["col_$columnIndex"] = $value
        }
        $exportRows.Add([pscustomobject]$row)
    }

    $exportRows | Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding UTF8
}

foreach ($year in 2022, 2023) {
    Convert-XlsCopyToXlsx -Year $year
    Write-Output "Reran XLS conversion for $year"
}

foreach ($year in 2014, 2015) {
    Convert-WordCopyTablesToCsv -Year $year
    Write-Output "Reran Word table extraction for $year"
}
