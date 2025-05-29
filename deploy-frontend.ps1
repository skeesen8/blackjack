# Frontend Deployment Script
param(
    [Parameter(Mandatory=$false)]
    [string]$Platform = "aws"
)

Write-Host "🚀 Deploying Blackjack Frontend" -ForegroundColor Yellow
Write-Host ""

# Generate unique bucket name with timestamp
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$bucketName = "blackjack-frontend-$timestamp"

Write-Host "📦 Building frontend for production..." -ForegroundColor Green

# Build the frontend
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed!" -ForegroundColor Green
Write-Host ""

Write-Host "☁️ Deploying to AWS S3..." -ForegroundColor Cyan
Write-Host "Bucket name: $bucketName" -ForegroundColor White

# Create S3 bucket
Write-Host "Creating S3 bucket..." -ForegroundColor White
aws s3 mb "s3://$bucketName"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create S3 bucket!" -ForegroundColor Red
    exit 1
}

# Upload files
Write-Host "Uploading files to S3..." -ForegroundColor White
aws s3 sync build/ "s3://$bucketName" --acl public-read

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to upload files!" -ForegroundColor Red
    exit 1
}

# Configure bucket for static website hosting
Write-Host "Configuring static website hosting..." -ForegroundColor White
aws s3 website "s3://$bucketName" --index-document index.html --error-document index.html

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to configure website hosting!" -ForegroundColor Red
    exit 1
}

# Remove public access block
Write-Host "Removing public access blocks..." -ForegroundColor White
aws s3api delete-public-access-block --bucket $bucketName

# Apply bucket policy for public read access
Write-Host "Applying bucket policy..." -ForegroundColor White
$bucketPolicyJson = '{"Version":"2012-10-17","Statement":[{"Sid":"PublicReadGetObject","Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::' + $bucketName + '/*"}]}'
$bucketPolicyJson | Out-File -FilePath "bucket-policy.json" -Encoding utf8
aws s3api put-bucket-policy --bucket $bucketName --policy file://bucket-policy.json

# Clean up temporary file
Remove-Item "bucket-policy.json" -ErrorAction SilentlyContinue

# Get website URL
$websiteUrl = "http://$bucketName.s3-website-us-east-1.amazonaws.com"

Write-Host ""
Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
Write-Host "🌐 Website URL: $websiteUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Don't forget to update CORS settings in your Lambda function" -ForegroundColor Yellow
Write-Host "   to allow your new frontend domain!" -ForegroundColor Yellow 