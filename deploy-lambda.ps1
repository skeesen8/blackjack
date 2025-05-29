# Configuration
$AWS_REGION = "us-east-1"
$ECR_REPOSITORY = "blackjack-backend"
$LAMBDA_FUNCTION_NAME = "blackjack-backend-prod"
$IMAGE_TAG = "latest"

# Function to print status messages
function Write-Status {
    param($Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

# Function to print error messages
function Write-Error {
    param($Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Get AWS account ID
try {
    $AWS_ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
    if (-not $?) {
        throw "Failed to get AWS account ID"
    }
} catch {
    Write-Error "Failed to get AWS account ID. Make sure you're logged in to AWS CLI."
    exit 1
}

# Delete and recreate ECR repository to clear any corrupted images
Write-Status "Deleting existing ECR repository..."
aws ecr delete-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION --force 2>$null

Write-Status "Creating fresh ECR repository..."
aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION
if (-not $?) {
    Write-Error "Failed to create ECR repository"
    exit 1
}

# Get ECR login token and login to Docker
Write-Status "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
if (-not $?) {
    Write-Error "Failed to login to ECR"
    exit 1
}

# Build Docker image
Write-Status "Building Docker image..."
Set-Location backend

# Clean up any existing images
Write-Status "Cleaning up existing images..."
docker rmi "${ECR_REPOSITORY}:${IMAGE_TAG}" 2>$null
docker rmi "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}" 2>$null

# Build the image without platform specification (let Docker choose)
# Use legacy Docker format instead of OCI format for Lambda compatibility
$env:DOCKER_BUILDKIT = "0"
docker build --no-cache -t "${ECR_REPOSITORY}:${IMAGE_TAG}" -f Dockerfile.lambda.arch .
if (-not $?) {
    Write-Error "Failed to build Docker image"
    exit 1
}

# Verify the image was built successfully
Write-Status "Verifying Docker image..."
$imageId = docker images -q "${ECR_REPOSITORY}:${IMAGE_TAG}"
if (-not $imageId) {
    Write-Error "Docker image was not built successfully"
    exit 1
}

Write-Status "Docker image built successfully with ID: $imageId"

# Tag Docker image
Write-Status "Tagging Docker image..."
docker tag "${ECR_REPOSITORY}:${IMAGE_TAG}" "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}"
if (-not $?) {
    Write-Error "Failed to tag Docker image"
    exit 1
}

# Push Docker image to ECR
Write-Status "Pushing Docker image to ECR..."
docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}"
if (-not $?) {
    Write-Error "Failed to push Docker image to ECR"
    exit 1
}

# Create IAM role for Lambda if it doesn't exist
Write-Status "Checking IAM role..."
$ROLE_NAME = "blackjack-lambda-role"
try {
    aws iam get-role --role-name $ROLE_NAME 2>$null
} catch {
    Write-Status "Creating IAM role..."
    
    # Create trust policy
    $trustPolicy = @{
        Version = "2012-10-17"
        Statement = @(
            @{
                Effect = "Allow"
                Principal = @{
                    Service = "lambda.amazonaws.com"
                }
                Action = "sts:AssumeRole"
            }
        )
    } | ConvertTo-Json

    # Create role
    aws iam create-role --role-name $ROLE_NAME --assume-role-policy-document $trustPolicy
    if (-not $?) {
        Write-Error "Failed to create IAM role"
        exit 1
    }

    # Attach basic Lambda execution policy
    aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
    if (-not $?) {
        Write-Error "Failed to attach Lambda execution policy"
        exit 1
    }

    # Create and attach DynamoDB policy
    $dynamoPolicy = @{
        Version = "2012-10-17"
        Statement = @(
            @{
                Effect = "Allow"
                Action = @(
                    "dynamodb:GetItem",
                    "dynamodb:PutItem",
                    "dynamodb:UpdateItem",
                    "dynamodb:DeleteItem",
                    "dynamodb:Scan",
                    "dynamodb:Query"
                )
                Resource = "arn:aws:dynamodb:${AWS_REGION}:${AWS_ACCOUNT_ID}:table/blackjack-games-prod"
            }
        )
    } | ConvertTo-Json

    aws iam create-policy --policy-name "blackjack-dynamodb-policy" --policy-document $dynamoPolicy
    if (-not $?) {
        Write-Error "Failed to create DynamoDB policy"
        exit 1
    }

    aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:policy/blackjack-dynamodb-policy"
    if (-not $?) {
        Write-Error "Failed to attach DynamoDB policy"
        exit 1
    }
}

# Get role ARN
$ROLE_ARN = (aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)
if (-not $?) {
    Write-Error "Failed to get role ARN"
    exit 1
}

# Create or update Lambda function
Write-Status "Creating/updating Lambda function..."
$functionExists = $false
try {
    $result = aws lambda get-function --function-name $LAMBDA_FUNCTION_NAME 2>$null
    if ($LASTEXITCODE -eq 0) {
        $functionExists = $true
    }
} catch {
    $functionExists = $false
}

if ($functionExists) {
    Write-Status "Updating existing Lambda function..."
    aws lambda update-function-code `
        --function-name $LAMBDA_FUNCTION_NAME `
        --image-uri "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}"
} else {
    Write-Status "Creating new Lambda function..."
    aws lambda create-function `
        --function-name $LAMBDA_FUNCTION_NAME `
        --package-type Image `
        --code ImageUri="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}" `
        --role $ROLE_ARN `
        --timeout 30 `
        --memory-size 512 `
        --region $AWS_REGION
}

if (-not $?) {
    Write-Error "Failed to create/update Lambda function"
    exit 1
}

Write-Status "Deployment completed successfully!" 