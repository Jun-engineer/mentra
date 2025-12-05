import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class MentraStack extends Stack {
  public readonly tenantTable: Table;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.tenantTable = new Table(this, "TenantTable", {
      tableName: process.env.MENTRA_TABLE_NAME ?? "mentra-tenant-table",
      partitionKey: { name: "PK", type: AttributeType.STRING },
      sortKey: { name: "SK", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true
      },
      timeToLiveAttribute: "expiresAt"
    });

    this.tenantTable.addLocalSecondaryIndex({
      indexName: "GSI1",
      sortKey: {
        name: "GSI1SK",
        type: AttributeType.STRING
      }
    });

    // Placeholder for Cognito, SES, and API Gateway resources that arrive in later iterations.
  }
}
