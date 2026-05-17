# PowerShell script to apply migration via Supabase Management API
$projectRef = "smopyfuaijaklmtpwgws"
# Set via: $env:SUPABASE_ACCESS_TOKEN = "your_token"
$accessToken = $env:SUPABASE_ACCESS_TOKEN

if (-not $accessToken) {
    throw "SUPABASE_ACCESS_TOKEN is not set. Set it before running this script."
}

# Read the SQL migration
$sql = Get-Content -Path "supabase\migrations\20260211_add_courier_notes_to_sales.sql" -Raw

# Use Supabase Management API to execute SQL
$uri = "https://api.supabase.com/v1/projects/$projectRef/database/query"
$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
}
$body = @{
    "query" = $sql
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body
    Write-Host "✓ Migration applied successfully!" -ForegroundColor Green
    Write-Host $response
} catch {
    Write-Host "✗ Failed to apply migration:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        Write-Host "Response: $($_.Exception.Response)"
    }
}
