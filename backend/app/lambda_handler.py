"""
AWS Lambda handler for the FastAPI blackjack application
"""
from mangum import Mangum
from app.main_lambda import app  # Use Lambda-specific version without WebSockets

# Create the Lambda handler with proper configuration for API Gateway
handler = Mangum(
    app, 
    lifespan="off",
    api_gateway_base_path="/",
    text_mime_types=["application/json", "application/javascript"]
)

# Export for Lambda
def lambda_handler(event, context):
    """
    AWS Lambda handler function
    """
    return handler(event, context) 