/**
 * Placeholder Lambda handler until real routes are wired via API Gateway.
 */
import { APIGatewayProxyResultV2 } from "aws-lambda";

export const handler = async (
): Promise<APIGatewayProxyResultV2> => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Mentra API is online." })
  };
};
