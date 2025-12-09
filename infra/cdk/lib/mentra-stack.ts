import * as path from "node:path";
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { AttributeType, BillingMode, ITable, Table } from "aws-cdk-lib/aws-dynamodb";
import { HttpApi, CorsHttpMethod, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { AllowedMethods, CachePolicy, Distribution, OriginAccessIdentity, ViewerProtocolPolicy } from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Code, Function as LambdaFunction, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface MentraStackProps extends StackProps {
  tenantTable?: {
    mode?: "create" | "import";
    tableName?: string;
    tableArn?: string;
  };
  site?: {
    bucketName?: string;
  };
}

export class MentraStack extends Stack {
  public readonly tenantTable: ITable;

  constructor(scope: Construct, id: string, props?: MentraStackProps) {
    super(scope, id, props);

    const tenantTableMode = (props?.tenantTable?.mode ?? process.env.MENTRA_TENANT_TABLE_MODE ?? "create").toLowerCase();
    const tenantTableName = props?.tenantTable?.tableName ?? process.env.MENTRA_TABLE_NAME ?? "mentra-tenant-table";
    const tenantTableArn = props?.tenantTable?.tableArn ?? process.env.MENTRA_TENANT_TABLE_ARN;
    let tenantTableNameForEnv = tenantTableName;

    if (tenantTableMode === "import" || tenantTableArn || process.env.MENTRA_TENANT_TABLE_IMPORT === "1") {
      const importAttributes = tenantTableArn
        ? { tableArn: tenantTableArn }
        : { tableName: tenantTableName };

      this.tenantTable = Table.fromTableAttributes(this, "TenantTable", importAttributes);
      if (tenantTableArn) {
        tenantTableNameForEnv = tenantTableArn.split("/").pop() ?? tenantTableNameForEnv;
      }
    } else {
      const createdTable = new Table(this, "TenantTable", {
        tableName: tenantTableName,
        partitionKey: { name: "PK", type: AttributeType.STRING },
        sortKey: { name: "SK", type: AttributeType.STRING },
        billingMode: BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.RETAIN,
        pointInTimeRecoverySpecification: {
          pointInTimeRecoveryEnabled: true
        },
        timeToLiveAttribute: "expiresAt"
      });

      createdTable.addLocalSecondaryIndex({
        indexName: "GSI1",
        sortKey: {
          name: "GSI1SK",
          type: AttributeType.STRING
        }
      });

      this.tenantTable = createdTable;
      tenantTableNameForEnv = createdTable.tableName;
    }

    const siteBucket = new Bucket(this, "FrontendBucket", {
      bucketName: props?.site?.bucketName ?? process.env.MENTRA_SITE_BUCKET,
      versioned: true,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false
    });

    const originAccessIdentity = new OriginAccessIdentity(this, "FrontendOAI", {
      comment: "Mentra frontend distribution access"
    });

    siteBucket.grantRead(originAccessIdentity);

    const bucketOrigin = S3BucketOrigin.withOriginAccessIdentity(siteBucket, {
      originAccessIdentity
    });

    const distribution = new Distribution(this, "FrontendDistribution", {
      defaultRootObject: "index.html",
      comment: "Mentra static frontend",
      defaultBehavior: {
        origin: bucketOrigin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        compress: true
      }
    });

    const rootDir = path.join(__dirname, "../../..");
    const skipBundling = process.env.CDK_SKIP_ASSET_BUNDLING === "1";
    const apiFunction = skipBundling
      ? new LambdaFunction(this, "MentraApiFunction", {
          runtime: Runtime.NODEJS_20_X,
          handler: "handler",
          code: Code.fromInline(
            "exports.handler = async () => ({ statusCode: 200, body: JSON.stringify({ ok: true }) });"
          ),
          environment: {
            MENTRA_TABLE_NAME: tenantTableNameForEnv
          },
          timeout: Duration.seconds(10)
        })
      : new NodejsFunction(this, "MentraApiFunction", {
          entry: path.join(rootDir, "services/api/src/index.ts"),
          handler: "handler",
          runtime: Runtime.NODEJS_20_X,
          projectRoot: rootDir,
          depsLockFilePath: path.join(rootDir, "pnpm-lock.yaml"),
          bundling: {
            format: OutputFormat.ESM,
            target: "node20",
            externalModules: ["aws-sdk"],
            minify: true,
            sourceMap: true
          },
          environment: {
            MENTRA_TABLE_NAME: tenantTableNameForEnv
          },
          timeout: Duration.seconds(10)
        });

    this.tenantTable.grantReadWriteData(apiFunction);

    const apiIntegration = new HttpLambdaIntegration("MentraApiIntegration", apiFunction);

    const api = new HttpApi(this, "MentraHttpApi", {
      corsPreflight: {
        allowHeaders: ["*"],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
        allowOrigins: ["*"]
      }
    });

    api.addRoutes({
      path: "/health",
      methods: [HttpMethod.GET],
      integration: apiIntegration
    });

    api.addRoutes({
      path: "/menu/{tenantId}",
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: apiIntegration
    });

    api.addRoutes({
      path: "/menu/{tenantId}/{itemId}",
      methods: [HttpMethod.GET],
      integration: apiIntegration
    });

    new CfnOutput(this, "FrontendBucketName", {
      value: siteBucket.bucketName,
      exportName: "MentraFrontendBucketName"
    });

    new CfnOutput(this, "CloudFrontDistributionId", {
      value: distribution.distributionId,
      exportName: "MentraCloudFrontDistributionId"
    });

    new CfnOutput(this, "CloudFrontDomainName", {
      value: distribution.domainName,
      exportName: "MentraCloudFrontDomainName"
    });

    new CfnOutput(this, "ApiEndpoint", {
      value: api.apiEndpoint,
      exportName: "MentraApiEndpoint"
    });
  }
}
