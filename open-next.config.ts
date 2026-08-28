// Config minimale OpenNext pour déploiement sur Lambda (dans le VPC, pour
// l'accès réseau au RDS privé — voir CLAUDE.md, Amplify Hosting Compute ne
// supporte pas le VPC). Pas de CloudFront/S3 pour l'instant : outil interne
// à faible trafic, Function URL suffit pour démarrer.
import type { OpenNextConfig } from "@opennextjs/aws/types/open-next.js"

const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: "aws-lambda-streaming",
    },
  },
}

export default config
