import { CfnOutput, Duration, Stack, StackProps } from "aws-cdk-lib";
import { ManagedPolicy, OpenIdConnectProvider, Role, WebIdentityPrincipal, IOpenIdConnectProvider } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface MentraPrereqStackProps extends StackProps {
  github?: {
    owner: string;
    repo: string;
    branch?: string;
    roleName?: string;
    providerArn?: string;
    providerStrategy?: "create" | "import";
  };
}

export class MentraPrereqStack extends Stack {
  public readonly provider: IOpenIdConnectProvider;
  public readonly deployRole: Role;

  constructor(scope: Construct, id: string, props?: MentraPrereqStackProps) {
    super(scope, id, props);

    const githubOwner = props?.github?.owner ?? process.env.MENTRA_GITHUB_OWNER ?? "Jun-engineer";
    const githubRepo = props?.github?.repo ?? process.env.MENTRA_GITHUB_REPO ?? "mentra";
    const githubBranch = props?.github?.branch ?? process.env.MENTRA_GITHUB_BRANCH ?? "main";
    const githubRoleName = props?.github?.roleName ?? process.env.MENTRA_GITHUB_ROLE ?? "MentraGithubDeployRole";
    const explicitProviderArn = props?.github?.providerArn ?? process.env.MENTRA_GITHUB_PROVIDER_ARN;
    const providerStrategy = (props?.github?.providerStrategy ?? process.env.MENTRA_GITHUB_PROVIDER_STRATEGY ?? "import").toLowerCase();

    if (explicitProviderArn) {
      this.provider = OpenIdConnectProvider.fromOpenIdConnectProviderArn(
        this,
        "GitHubOidcProvider",
        explicitProviderArn
      );
    } else if (providerStrategy === "import") {
      const assumedArn = `arn:${this.partition}:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`;
      this.provider = OpenIdConnectProvider.fromOpenIdConnectProviderArn(
        this,
        "GitHubOidcProvider",
        assumedArn
      );
    } else {
      this.provider = new OpenIdConnectProvider(this, "GitHubOidcProvider", {
        url: "https://token.actions.githubusercontent.com",
        clientIds: ["sts.amazonaws.com"]
      });
    }

    this.deployRole = new Role(this, "GithubActionsRole", {
      roleName: githubRoleName,
      assumedBy: new WebIdentityPrincipal(this.provider.openIdConnectProviderArn, {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        StringLike: {
          "token.actions.githubusercontent.com:sub": [
            `repo:${githubOwner}/${githubRepo}:ref:refs/heads/${githubBranch}`,
            `repo:${githubOwner}/${githubRepo}:ref:refs/tags/*`
          ]
        }
      }),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")],
      maxSessionDuration: Duration.hours(1)
    });

    new CfnOutput(this, "GithubDeployRoleArn", {
      value: this.deployRole.roleArn,
      exportName: "MentraGithubDeployRoleArn"
    });

    new CfnOutput(this, "GithubOidcProviderArn", {
      value: this.provider.openIdConnectProviderArn,
      exportName: "MentraGithubOidcProviderArn"
    });
  }
}
