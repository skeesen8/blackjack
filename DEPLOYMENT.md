# AWS Lambda Deployment Guide

This guide will help you deploy your Blackjack game to AWS Lambda using Docker containers.

## Prerequisites

Before deploying, ensure you have the following installed and configured:

### Required Tools
- **AWS CLI v2** - [Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- **Docker** - [Installation Guide](https://docs.docker.com/get-docker/)
- **Node.js & npm** - [Installation Guide](https://nodejs.org/)

### AWS Setup
1. **AWS Account** with appropriate permissions
2. **AWS CLI configured** with your credentials:
   ```bash
   aws configure
   ```
3. **Required IAM permissions**:
   - Lambda full access
   - ECR full access
   - CloudFormation full access
   - S3 full access
   - CloudFront full access
   - API Gateway full access
   - DynamoDB full access

## Deployment Architecture

The deployment creates the following AWS resources:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CloudFront    │───▶│       S3         │    │   API Gateway   │
│  (Frontend CDN) │    │ (React Frontend) │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │     Lambda      │
                                               │ (FastAPI Backend│
                                               │  + WebSocket)   │
                                               └─────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │    DynamoDB     │
                                               │ (Game State)    │
                                               └─────────────────┘
```

## Quick Deployment

### Option 1: One-Command Deployment (Recommended)

Make the deployment script executable and run it:

```bash
chmod +x deploy-full-stack.sh
./deploy-full-stack.sh
```

This script will:
1. ✅ Check prerequisites
2. 🏗️ Deploy AWS infrastructure via CloudFormation
3. 🐍 Build and deploy the backend to Lambda
4. ⚛️ Build and deploy the frontend to S3/CloudFront

### Option 2: Step-by-Step Deployment

#### Step 1: Deploy Infrastructure

```bash
aws cloudformation deploy \
    --template-file infrastructure/cloudformation-template.yaml \
    --stack-name blackjack-infrastructure-prod \
    --parameter-overrides \
        ProjectName=blackjack \
        Environment=prod \
    --capabilities CAPABILITY_NAMED_IAM \
    --region us-east-1
```

#### Step 2: Deploy Backend

```bash
cd backend
chmod +x deploy.sh
./deploy.sh
```

#### Step 3: Deploy Frontend

```bash
cd frontend
npm install
npm run build

# Get S3 bucket name from CloudFormation
BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name blackjack-infrastructure-prod \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
    --output text)

aws s3 sync build/ s3://$BUCKET_NAME --delete
```

## Configuration

### Environment Variables

The deployment script automatically configures environment variables, but you can customize them:

#### Backend (Lambda Environment Variables)
- `ENVIRONMENT`: Deployment environment (prod, staging, dev)
- `DYNAMODB_TABLE`: DynamoDB table name (auto-configured)

#### Frontend (React Environment Variables)
- `REACT_APP_API_URL`: API Gateway URL (auto-configured)
- `REACT_APP_WS_URL`: WebSocket URL (auto-configured)
- `REACT_APP_ENVIRONMENT`: Environment name

### Customization

You can customize the deployment by modifying these files:

- **`deploy-full-stack.sh`**: Main deployment configuration
- **`infrastructure/cloudformation-template.yaml`**: AWS infrastructure
- **`backend/deploy.sh`**: Backend-specific deployment
- **`backend/Dockerfile`**: Docker container configuration

## Monitoring & Debugging

### CloudWatch Logs

Monitor your application logs:

```bash
# View Lambda logs
aws logs tail /aws/lambda/blackjack-backend-prod --follow

# View API Gateway logs
aws logs tail API-Gateway-Execution-Logs_<api-id>/prod --follow
```

### Lambda Function Testing

Test your Lambda function directly:

```bash
aws lambda invoke \
    --function-name blackjack-backend-prod \
    --payload '{"httpMethod":"GET","path":"/health"}' \
    response.json

cat response.json
```

### Common Issues & Solutions

#### Issue: Docker build fails
**Solution**: Ensure Docker is running and you have sufficient disk space

#### Issue: ECR push fails
**Solution**: Check AWS credentials and ECR repository permissions

#### Issue: Lambda deployment fails
**Solution**: Verify IAM role permissions and function configuration

#### Issue: Frontend not loading
**Solution**: Check S3 bucket permissions and CloudFront distribution

#### Issue: WebSocket connections fail
**Solution**: Ensure API Gateway WebSocket route is properly configured

## Performance Optimization

### Lambda Configuration
- **Memory**: 512MB (adjustable based on load)
- **Timeout**: 30 seconds
- **Concurrent Executions**: Auto-scaling enabled

### Cost Optimization
- **Lambda**: Pay per request
- **DynamoDB**: On-demand billing
- **S3**: Standard storage class
- **CloudFront**: Global edge locations

## Security Considerations

### HTTPS/SSL
- CloudFront provides SSL termination
- API Gateway uses AWS-managed certificates

### CORS Configuration
- Configured for your frontend domain
- Restricts cross-origin requests

### IAM Permissions
- Principle of least privilege
- Function-specific execution roles

## Scaling

The architecture automatically scales:

- **Lambda**: Handles concurrent requests automatically
- **DynamoDB**: On-demand scaling
- **CloudFront**: Global CDN for frontend delivery
- **API Gateway**: Handles WebSocket connections at scale

## Custom Domain Setup (Optional)

To use a custom domain:

1. **Register domain** in Route 53 or your DNS provider
2. **Create SSL certificate** in ACM
3. **Update CloudFormation template** with domain configuration
4. **Configure DNS records** to point to CloudFront

## Cleanup

To remove all AWS resources:

```bash
# Delete CloudFormation stack
aws cloudformation delete-stack --stack-name blackjack-infrastructure-prod

# Delete ECR repository
aws ecr delete-repository --repository-name blackjack-backend --force

# Empty and delete S3 bucket (if needed)
aws s3 rm s3://your-frontend-bucket --recursive
```

## Support

For issues or questions:

1. Check CloudWatch logs for error details
2. Verify AWS service quotas and limits
3. Review IAM permissions
4. Test individual components separately

## Estimated Costs

Monthly costs for moderate usage:
- **Lambda**: $5-20 (based on requests)
- **DynamoDB**: $1-10 (based on data)
- **S3**: $1-5 (storage and requests)
- **CloudFront**: $1-10 (data transfer)
- **API Gateway**: $3-15 (WebSocket connections)

**Total**: ~$10-60/month for a production application 