// Config minimale OpenNext pour déploiement sur Lambda (dans le VPC, pour
// l'accès réseau au RDS privé — voir CLAUDE.md, Amplify Hosting Compute ne
// supporte pas le VPC). CloudFront + un bucket S3 dédié (voir CLAUDE.md)
// servent maintenant les assets statiques (_next/static/*, BUILD_ID,
// noise.png) — à chaque déploiement, synchroniser `.open-next/assets` vers
// ce bucket EN PLUS du zip Lambda (aws s3 sync .open-next/assets/
// s3://archiaccess-ai-sit-static-638954279923/_assets/), sinon la page ne
// s'hydrate jamais côté navigateur (bundle JS 404).
import type { OpenNextConfig } from "@opennextjs/aws/types/open-next.js"

const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: "aws-lambda-streaming",
    },
  },
}

export default config
