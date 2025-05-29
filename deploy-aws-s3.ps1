# AWS S3 + CloudFront Frontend Deployment Script
param(
    [Parameter(Mandatory=$false)]
    [string]$BucketName = "blackjack-frontend-$(Get-Date -Format 'yyyyMMdd-HHmmss')",
    [Parameter(Mandatory=$false)]
    [string]$AWS_REGION = "us-east-1"
)

Write-Host "Deploying Blackjack Frontend to AWS S3 + CloudFront" -ForegroundColor Yellow
Write-Host "Bucket: $BucketName" -ForegroundColor Cyan
Write-Host ""

# Change to frontend directory first
Set-Location frontend

# Set environment variables for production build
$env:REACT_APP_API_URL = "https://2rvv90im0j.execute-api.us-east-1.amazonaws.com/prod"
$env:REACT_APP_WS_URL = "wss://2rvv90im0j.execute-api.us-east-1.amazonaws.com/prod"

Write-Host "Building frontend for production..." -ForegroundColor Green
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Build completed!" -ForegroundColor Green
Write-Host ""

# Go back to root for AWS operations
Set-Location ..

# Create S3 bucket
Write-Host "Creating S3 bucket..." -ForegroundColor Green
aws s3 mb s3://$BucketName --region $AWS_REGION

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create S3 bucket!" -ForegroundColor Red
    exit 1
}

# Configure bucket for static website hosting
Write-Host "Configuring static website hosting..." -ForegroundColor Green
aws s3 website s3://$BucketName --index-document index.html --error-document index.html

# Create bucket policy for public read access
Write-Host "Creating bucket policy..." -ForegroundColor Green

# Create the JSON policy using PowerShell object to avoid encoding issues
$policyObject = @{
    Version = "2012-10-17"
    Statement = @(
        @{
            Sid = "PublicReadGetObject"
            Effect = "Allow"
            Principal = "*"
            Action = "s3:GetObject"
            Resource = "arn:aws:s3:::$BucketName/*"
        }
    )
}

$bucketPolicyContent = $policyObject | ConvertTo-Json -Depth 10
$bucketPolicyContent | Out-File -FilePath "bucket-policy.json" -Encoding UTF8 -NoNewline
aws s3api put-bucket-policy --bucket $BucketName --policy file://bucket-policy.json
Remove-Item "bucket-policy.json"

# Upload files to S3 (removed --acl public-read as S3 blocks ACLs by default now)
Write-Host "Uploading files to S3..." -ForegroundColor Green
aws s3 sync frontend/build/ s3://$BucketName --delete

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to upload files!" -ForegroundColor Red
    exit 1
}

# Create CloudFront distribution
Write-Host "Creating CloudFront distribution..." -ForegroundColor Green

# Create CloudFront config using PowerShell object
$cloudFrontObject = @{
    CallerReference = "$BucketName-$(Get-Date -Format 'yyyyMMddHHmmss')"
    Comment = "Blackjack Frontend Distribution"
    DefaultCacheBehavior = @{
        TargetOriginId = "$BucketName-origin"
        ViewerProtocolPolicy = "redirect-to-https"
        MinTTL = 0
        ForwardedValues = @{
            QueryString = $false
            Cookies = @{
                Forward = "none"
            }
        }
        TrustedSigners = @{
            Enabled = $false
            Quantity = 0
        }
    }
    Origins = @{
        Quantity = 1
        Items = @(
            @{
                Id = "$BucketName-origin"
                DomainName = "$BucketName.s3-website-$AWS_REGION.amazonaws.com"
                CustomOriginConfig = @{
                    HTTPPort = 80
                    HTTPSPort = 443
                    OriginProtocolPolicy = "http-only"
                }
            }
        )
    }
    Enabled = $true
    DefaultRootObject = "index.html"
    CustomErrorResponses = @{
        Quantity = 1
        Items = @(
            @{
                ErrorCode = 404
                ResponsePagePath = "/index.html"
                ResponseCode = "200"
                ErrorCachingMinTTL = 300
            }
        )
    }
    PriceClass = "PriceClass_100"
}

$cloudFrontConfigContent = $cloudFrontObject | ConvertTo-Json -Depth 10
$cloudFrontConfigContent | Out-File -FilePath "cloudfront-config.json" -Encoding UTF8 -NoNewline

try {
    $distributionResult = aws cloudfront create-distribution --distribution-config file://cloudfront-config.json | ConvertFrom-Json
    $distributionId = $distributionResult.Distribution.Id
    $cloudFrontDomain = $distributionResult.Distribution.DomainName
    Write-Host "CloudFront distribution created: $distributionId" -ForegroundColor Green
} catch {
    Write-Host "Failed to create CloudFront distribution!" -ForegroundColor Red
    Write-Host "Your site is still available via S3!" -ForegroundColor Yellow
}

Remove-Item "cloudfront-config.json" -ErrorAction SilentlyContinue

# Get website URLs
$s3WebsiteUrl = "http://$BucketName.s3-website-$AWS_REGION.amazonaws.com"

Write-Host ""
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Your websites are available at:" -ForegroundColor Green
Write-Host "   S3 Website: $s3WebsiteUrl" -ForegroundColor Cyan
if ($cloudFrontDomain) {
    Write-Host "   CloudFront: https://$cloudFrontDomain" -ForegroundColor Cyan
    Write-Host "   (CloudFront may take 10-15 minutes to deploy globally)" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update CORS in your Lambda function to allow:" -ForegroundColor White
Write-Host "   - $s3WebsiteUrl" -ForegroundColor Gray
if ($cloudFrontDomain) {
    Write-Host "   - https://$cloudFrontDomain" -ForegroundColor Gray
}
Write-Host "2. Test your application at the URLs above" -ForegroundColor White
Write-Host "3. (Optional) Set up a custom domain with Route 53" -ForegroundColor White
Write-Host ""
Write-Host "Bucket name: $BucketName" -ForegroundColor White
if ($distributionId) {
    Write-Host "CloudFront ID: $distributionId" -ForegroundColor White
} 