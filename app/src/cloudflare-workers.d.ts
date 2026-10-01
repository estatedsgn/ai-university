declare module "cloudflare:workers" {
  export const env: unknown;
  export class DurableObject<Env = unknown> {
    protected ctx: import("@cloudflare/workers-types").DurableObjectState;
    protected env: Env;
    constructor(ctx: import("@cloudflare/workers-types").DurableObjectState, env: Env);
  }
}
